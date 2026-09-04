import { z } from "zod";

import { db, one, rows as query } from "./core/db.ts";
import { POSTING_COLUMNS, Posting } from "./core/posting.ts";
import { TABLES, options as allowed } from "./core/schema.ts";
import * as sources from "./core/sources.ts";
import { ageDays, norm, normCompany } from "./core/text.ts";

export const DISPOSITIONS: Record<string, string> = {
  expired: "a listing whose `date_valid_through` has passed",
  lowball: "a STATED YEARLY band topping out below `comp_floor`; per-hour or unstated is not judged",
  stale: "older than `max_age_days`",
  seen: "already kept, or already collapsed into a kept row, by key or company + title",
  duplicate: "one role listed in several places, collapsed into the row that was kept",
};

export type Options = {
  redo?: boolean;
  include_seen?: boolean;
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
  include_seen: boolean;
  max_age_days: number;
  comp_floor: number;
};

const MAX_AGE_DAYS = 30;

const maxAgeDays = () => {
  const held = one(TABLES.settings.pick({ value: true }), "SELECT value FROM settings WHERE key='max_age_days'");
  return Number(held?.value ?? MAX_AGE_DAYS);
};

function loadConfig(options: Options): Config {
  const floor = one(TABLES.identity.pick({ compensation_floor: true }), "SELECT compensation_floor FROM identity");

  return {
    include_seen: Boolean(options.include_seen),
    max_age_days: options.max_age_days ?? maxAgeDays(),
    comp_floor: options.comp_floor ?? Number(floor?.compensation_floor ?? 0),
  };
}

const belowCompFloor = (row: Posting, floor: number) => {
  if (!floor || row.comp_period !== "YEARLY") return false;
  const top = row.comp_max ?? row.comp_min;
  return Boolean(top) && (top as number) < floor;
};

const paired = (company: string, title: string) => `${normCompany(company)} ${norm(title)}`;

function verdict(
  row: Posting,
  config: Config,
  seenKeys: Set<string>,
  held: Map<string, string>,
): [string | null, string | null] {
  if (row.expired) return ["expired", null];
  if (belowCompFloor(row, config.comp_floor)) return ["lowball", null];

  const days = ageDays(row.posted_at);
  if (config.max_age_days && days !== null && days > config.max_age_days) return ["stale", null];

  if (!config.include_seen) {
    if (seenKeys.has(row.key)) return ["seen", null];
    const holder = held.get(paired(row.company, row.title));
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
    group.sort(
      (one, two) =>
        Number(!pinned.has(one.key)) - Number(!pinned.has(two.key)) ||
        Number(!one.remote) - Number(!two.remote) ||
        one.key.localeCompare(two.key),
    );
    const [primary, ...siblings] = group;
    dupes.push(...siblings);
    kept.push([primary, siblings.map((row) => row.key)]);
  }
  return { kept, dupes };
}

const pendingCount = () =>
  one(z.object({ n: z.number() }), "SELECT COUNT(*) n FROM postings WHERE disposition IS NULL")!.n;

export function rule(options: Options = {}): Ruled {
  const declared = [...allowed("postings", "disposition")].sort();
  const mine = [...Object.keys(DISPOSITIONS), "kept"].sort();
  if (mine.join(",") !== declared.join(","))
    throw new Error("DISPOSITIONS and the schema disagree about what a posting can be ruled");

  const config = loadConfig(options);

  const where = options.redo ? "WHERE disposition IS NOT 'kept'" : "WHERE disposition IS NULL";
  const pending = query(Posting, `SELECT ${POSTING_COLUMNS.join(",")} FROM postings ${where}`);

  const counts: Record<string, number> = Object.fromEntries(Object.keys(DISPOSITIONS).map((name) => [name, 0]));
  if (!pending.length) return { kept: 0, examined: 0, counts, pending: pendingCount() };

  const live = query(
    TABLES.postings.pick({ key: true, company: true, title: true }),
    "SELECT key, company, title FROM postings WHERE disposition='kept'",
  );
  const pinned = new Set(live.map((row) => row.key));
  const seenKeys = config.include_seen
    ? new Set<string>()
    : new Set([
        ...pinned,
        ...query(TABLES.postings.pick({ key: true }), "SELECT key FROM postings WHERE canonical_key IS NOT NULL").map(
          (row) => row.key,
        ),
      ]);
  const held = new Map<string, string>();
  if (!config.include_seen) for (const row of live) held.set(paired(row.company, row.title), row.key);

  const survivors: Posting[] = [];
  const dispositions: [string, string | null, string][] = [];

  for (const row of pending) {
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

  db().transaction(() => {
    const rule = db().prepare(
      "UPDATE postings SET disposition=?, canonical_key=COALESCE(?, canonical_key)," +
        "  ingested_on=date('now') WHERE key=?",
    );
    for (const ruling of dispositions) rule.run(ruling);
  })();

  return {
    kept: kept.length,
    examined: pending.length,
    counts,
    pending: pendingCount(),
  };
}

export type Aim = {
  terms: string[];
  notTitles: string[];
  notOrganizations: string[];
  locations: string[];
  remote: boolean;
  since: sources.Since;
  max: number;
};

export type Found = Ruled & {
  fetched: number;
  fresh: number;
};

export function store(postings: Posting[]) {
  const known = new Set(query(TABLES.postings.pick({ key: true }), "SELECT key FROM postings").map((row) => row.key));
  const insert = db().prepare(
    `INSERT INTO postings(${POSTING_COLUMNS.join(",")},first_fetched,last_fetched) ` +
      `VALUES(${POSTING_COLUMNS.map(() => "?").join(",")},date('now'),date('now')) ` +
      "ON CONFLICT(key) DO UPDATE SET " +
      "  last_fetched=date('now')," +
      "  title=excluded.title, location=excluded.location, remote=excluded.remote," +
      "  expired=excluded.expired," +
      "  compensation=COALESCE(excluded.compensation, postings.compensation)," +
      "  description=COALESCE(excluded.description, postings.description)," +
      "  raw=COALESCE(excluded.raw, postings.raw)",
  );

  let fresh = 0;
  db().transaction(() => {
    for (const posting of postings) {
      if (!known.has(posting.key)) fresh += 1;
      insert.run(POSTING_COLUMNS.map((column) => posting[column]));
    }
  })();
  return fresh;
}

export async function search(aim: Aim): Promise<Found> {
  if (!aim.terms.length) throw new Error("name what to search for, short and literal");
  if (!aim.max) throw new Error("say how many jobs to buy: --max <n>");
  if (!aim.since) throw new Error(`say how far back to search: --since ${sources.SINCE.join(" | ")}`);
  const held = await sources.search({
    terms: aim.terms,
    notTitles: aim.notTitles,
    notOrganizations: aim.notOrganizations,
    locations: aim.locations,
    remote: aim.remote,
    since: aim.since,
    max: aim.max,
  });
  return found(held);
}

export function replay(payload: unknown): Found {
  const items = Array.isArray(payload) ? payload : ((payload as { items?: unknown[] })?.items ?? []);
  return found(sources.fromApify(items));
}

function found(held: Posting[]): Found {
  const fresh = store(held);
  return { fetched: held.length, fresh, ...rule() };
}
