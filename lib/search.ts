import type { Database } from "better-sqlite3";

import { ddl } from "./core/db.ts";
import { POSTING_COLUMNS, Posting } from "./core/posting.ts";
import { vocabulary } from "./core/ddl.ts";
import * as sources from "./core/sources.ts";
import {
  ageDays, compilePatterns, literals, matchesAny, norm, normCompany,
} from "./core/text.ts";

export const DISPOSITIONS: Record<string, string> = {
  expired: "a listing whose `date_valid_through` has passed",
  agency: "reposters and body shops, by `agency_blocklist` name or `agency_name_patterns`",
  noise: "`title_noise` -- AI Trainer, annotation, tutoring, freelance-gig phrasing",
  lowball:
    "a STATED YEARLY band topping out below `comp_floor`; per-hour or unstated is not judged",
  title: "fails `title_include`, or matches `title_exclude`",
  location:
    "fails `location_include`, or matches `location_exclude` with no US anchor; " +
    "remote skips the include test",
  stale: "older than `max_age_days`",
  seen: "already kept, or already collapsed into a kept row, by key or company + title",
  duplicate: "one role listed in several places, collapsed into the row that was kept",
};

const PATTERN_KINDS = ["title_include", "title_exclude", "location_include", "location_exclude",
  "us_tokens", "title_noise", "agency_name_patterns"] as const;

export const patterns = (database: Database, kind: string) =>
  (database.prepare("SELECT pattern FROM filters WHERE kind=?")
    .all(kind) as { pattern: string }[]).map((row) => row.pattern);

export type Options = {
  redo?: boolean;
  include_seen?: boolean;
  location_filter?: boolean;
  max_age_days?: number | null;
  comp_floor?: number | null;
};

export type Ruled = {
  kept: number;
  examined: number;
  counts: Record<string, number>;
  pending: number;
};

type Config = {
  include_seen: boolean; location_filter: boolean;
  max_age_days: number; comp_floor: number;
  agency_blocklist: Set<string>;
} & Record<(typeof PATTERN_KINDS)[number], RegExp[]>;

function loadConfig(database: Database, options: Options): Config {
  const settings = Object.fromEntries(
    (database.prepare("SELECT key,value FROM settings").all() as { key: string; value: string }[])
      .map((row) => [row.key, row.value]));

  const floor = database.prepare("SELECT compensation_floor FROM identity")
    .get() as { compensation_floor: number | null } | undefined;

  return {
    include_seen: Boolean(options.include_seen),
    location_filter: options.location_filter !== false,
    ...Object.fromEntries(
      PATTERN_KINDS.map((kind) => [kind, compilePatterns(patterns(database, kind))])),
    agency_blocklist: new Set(patterns(database, "agency_blocklist").map(normCompany)),
    max_age_days: options.max_age_days ?? Number(settings.max_age_days ?? 30),
    comp_floor: options.comp_floor ?? Number(floor?.compensation_floor ?? 0),
  } as Config;
}

const belowCompFloor = (row: Posting, floor: number) => {
  if (!floor || row.comp_period !== "YEARLY") return false;
  const top = row.comp_max ?? row.comp_min;
  return Boolean(top) && (top as number) < floor;
};

const paired = (company: string, title: string) => `${normCompany(company)} ${norm(title)}`;

function verdict(
  row: Posting, config: Config, seenKeys: Set<string>, held: Map<string, string>,
): [string | null, string | null] {
  const { title, company } = row;
  const location = row.location || "";

  if (row.expired) return ["expired", null];
  if (config.agency_blocklist.has(normCompany(company)) ||
      matchesAny(config.agency_name_patterns, company)) return ["agency", null];
  if (matchesAny(config.title_noise, title)) return ["noise", null];
  if (belowCompFloor(row, config.comp_floor)) return ["lowball", null];

  if (config.title_include.length && !matchesAny(config.title_include, title))
    return ["title", null];
  if (matchesAny(config.title_exclude, title)) return ["title", null];

  if (config.location_filter) {
    const anchored =
      matchesAny(config.us_tokens, location) || location.trim().toLowerCase() === "remote";
    if (config.location_exclude.length && !anchored &&
        matchesAny(config.location_exclude, location)) return ["location", null];
    if (config.location_include.length && !row.remote &&
        !matchesAny(config.location_include, location)) return ["location", null];
  }

  const days = ageDays(row.posted_at);
  if (config.max_age_days && days !== null && days > config.max_age_days) return ["stale", null];

  if (!config.include_seen) {
    if (seenKeys.has(row.key)) return ["seen", null];
    const holder = held.get(paired(company, title));
    if (holder) return ["seen", holder];
  }
  return [null, null];
}

function collapse(rows: Posting[], pinned: Set<string>) {
  const grouped = new Map<string, Posting[]>();
  for (const row of rows) {
    const group = paired(row.company, row.title);
    grouped.set(group, [...(grouped.get(group) ?? []), row]);
  }

  const kept: [Posting, string[]][] = [];
  const dupes: Posting[] = [];
  for (const group of grouped.values()) {
    group.sort((one, two) =>
      Number(!pinned.has(one.key)) - Number(!pinned.has(two.key)) ||
      Number(!one.remote) - Number(!two.remote) ||
      one.key.localeCompare(two.key));
    const [primary, ...siblings] = group;
    dupes.push(...siblings);
    kept.push([primary, siblings.map((row) => row.key)]);
  }
  return { kept, dupes };
}

const pendingCount = (database: Database) =>
  (database.prepare("SELECT COUNT(*) n FROM postings WHERE disposition IS NULL")
    .get() as { n: number }).n;

export function rule(database: Database, options: Options = {}): Ruled {
  const declared = [...vocabulary(ddl(), "postings", "disposition")].sort();
  const mine = [...Object.keys(DISPOSITIONS), "kept"].sort();
  if (mine.join(",") !== declared.join(","))
    throw new Error("DISPOSITIONS and the schema disagree about what a posting can be ruled");

  const config = loadConfig(database, options);

  const where = options.redo ? "WHERE disposition IS NOT 'kept'" : "WHERE disposition IS NULL";
  const rows = (database.prepare(
    `SELECT ${POSTING_COLUMNS.join(",")} FROM postings ${where}`).all() as unknown[])
    .map((row) => Posting.parse(row));

  const counts: Record<string, number> = Object.fromEntries(
    Object.keys(DISPOSITIONS).map((name) => [name, 0]));
  if (!rows.length)
    return { kept: 0, examined: 0, counts, pending: pendingCount(database) };

  const live = database.prepare(
    "SELECT key, company, title FROM postings WHERE disposition='kept'")
    .all() as { key: string; company: string; title: string }[];
  const pinned = new Set(live.map((row) => row.key));
  const seenKeys = config.include_seen ? new Set<string>() : new Set([
    ...pinned,
    ...(database.prepare("SELECT key FROM postings WHERE canonical_key IS NOT NULL")
      .all() as { key: string }[]).map((row) => row.key),
  ]);
  const held = new Map<string, string>();
  if (!config.include_seen)
    for (const row of live) held.set(paired(row.company, row.title), row.key);

  const survivors: Posting[] = [];
  const dispositions: [string, string | null, string][] = [];

  for (const row of rows) {
    const [ruling, target] = verdict(row, config, seenKeys, held);
    if (ruling) {
      counts[ruling] += 1;
      dispositions.push([ruling, target === row.key ? null : target, row.key]);
    } else {
      survivors.push(row);
    }
  }

  const { kept, dupes } = collapse(survivors, pinned);
  counts.duplicate += dupes.length;

  for (const [row, siblings] of kept) {
    dispositions.push(["kept", null, row.key]);
    for (const alias of siblings) dispositions.push(["duplicate", row.key, alias]);
  }

  database.transaction(() => {
    const rule = database.prepare(
      "UPDATE postings SET disposition=?, canonical_key=COALESCE(?, canonical_key)," +
      "  ingested_on=date('now') WHERE key=?");
    for (const ruling of dispositions) rule.run(ruling);
  })();

  return {
    kept: kept.length,
    examined: rows.length,
    counts,
    pending: pendingCount(database),
  };
}

export const DEFAULTS = {
  locations: ["United States"],
  remote: false,
  since: "7d" as sources.Since,
  max: 200,
};

export type Aim = {
  terms: string[];
  locations?: string[];
  remote?: boolean;
  since?: sources.Since;
  max?: number;
};

export type Found = Ruled & { fetched: number; fresh: number; unkeepable: string[] };

export function store(database: Database, postings: Posting[]) {
  const known = new Set((database.prepare("SELECT key FROM postings").all() as { key: string }[])
    .map((row) => row.key));
  const insert = database.prepare(
    `INSERT INTO postings(${POSTING_COLUMNS.join(",")},first_fetched,last_fetched) ` +
    `VALUES(${POSTING_COLUMNS.map(() => "?").join(",")},date('now'),date('now')) ` +
    "ON CONFLICT(key) DO UPDATE SET " +
    "  last_fetched=date('now')," +
    "  title=excluded.title, location=excluded.location, remote=excluded.remote," +
    "  expired=excluded.expired," +
    "  compensation=COALESCE(excluded.compensation, postings.compensation)," +
    "  description=COALESCE(excluded.description, postings.description)," +
    "  raw=COALESCE(excluded.raw, postings.raw)");

  let fresh = 0;
  database.transaction(() => {
    for (const posting of postings) {
      if (!known.has(posting.key)) fresh += 1;
      insert.run(POSTING_COLUMNS.map((column) => posting[column]));
    }
  })();
  return fresh;
}

export function unkeepable(database: Database, terms: string[]) {
  const include = compilePatterns(patterns(database, "title_include"));
  if (!include.length) return [];
  return terms.filter((term) => !matchesAny(include, term));
}

const unwanted = (database: Database) => ({
  notTitles: [...new Set(["title_exclude", "title_noise"]
    .flatMap((kind) => patterns(database, kind).flatMap(literals)))],
  notOrganizations: patterns(database, "agency_blocklist"),
});

export async function search(database: Database, aim: Aim): Promise<Found> {
  if (!aim.terms.length) throw new Error("name what to search for, short and literal");
  const held = await sources.search({
    terms: aim.terms,
    locations: aim.locations?.length ? aim.locations : DEFAULTS.locations,
    remote: aim.remote ?? DEFAULTS.remote,
    since: aim.since ?? DEFAULTS.since,
    max: aim.max ?? DEFAULTS.max,
    ...unwanted(database),
  });
  return found(database, held, unkeepable(database, aim.terms));
}

export function replay(database: Database, payload: unknown): Found {
  const items = Array.isArray(payload)
    ? payload
    : (payload as { items?: unknown[] })?.items ?? [];
  return found(database, sources.fromApify(items), []);
}

function found(database: Database, held: Posting[], unkeepable: string[]): Found {
  const fresh = store(database, held);
  return { fetched: held.length, fresh, unkeepable, ...rule(database) };
}
