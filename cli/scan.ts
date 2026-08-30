#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import { Command } from "commander";
import type { Database } from "better-sqlite3";

import { ddl, open } from "../lib/db.ts";
import { POSTING_COLUMNS, Posting } from "../lib/posting.ts";
import { vocabulary } from "../lib/schema.ts";
import * as sources from "../lib/sources.ts";
import {
  ageDays, compilePatterns, literals, matchesAny, norm, normCompany,
} from "../lib/text.ts";
import { fail, guard } from "./kit.ts";

const collect = (value: string, held: string[]) => [...held, value];

function store(database: Database, postings: Posting[]) {
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

function nextStep(database: Database) {
  const { n } = database
    .prepare("SELECT COUNT(*) n FROM postings WHERE disposition IS NULL")
    .get() as { n: number };
  console.log(`\nnothing filtered yet — ${n} postings pending; ` +
    "run job-scan ingest to derive prospects");
}

const DISPOSITIONS: Record<string, string> = {
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

type Config = {
  include_seen: boolean; location_filter: boolean;
  max_age_days: number; comp_floor: number;
  agency_blocklist: Set<string>;
} & Record<(typeof PATTERN_KINDS)[number], RegExp[]>;

type Options = {
  include_seen: boolean; location_filter: boolean;
  max_age_days: number | null; comp_floor: number | null;
};

const stored = (database: Database, kind: string) =>
  (database.prepare("SELECT pattern FROM filters WHERE kind=?")
    .all(kind) as { pattern: string }[]).map((row) => row.pattern);

function loadConfig(database: Database, options: Options): Config {
  const settings = Object.fromEntries(
    (database.prepare("SELECT key,value FROM settings").all() as { key: string; value: string }[])
      .map((row) => [row.key, row.value]));

  const floor = database.prepare("SELECT compensation_floor FROM identity")
    .get() as { compensation_floor: number | null } | undefined;

  return {
    ...options,
    ...Object.fromEntries(
      PATTERN_KINDS.map((kind) => [kind, compilePatterns(stored(database, kind))])),
    agency_blocklist: new Set(stored(database, "agency_blocklist").map(normCompany)),
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

const program = new Command("job-scan").description(
  `Phase 1 — fetch postings, then rule on them. Two steps, and they stay separate.

  job-scan source                           the one search API: endpoint, quirks
  job-scan search                           your preferred titles across every career site
  job-scan search --title "AI Engineer" --location "Oregon, United States"
  job-scan search --remote --since 24h      only what a remote worker can hold
  job-scan watchlist                        every live job at the companies you watch
  job-scan ingest                           postings into prospects, no network
  job-scan ingest --redo --no-location-filter
  job-scan dispositions                     every verdict, in the order ruled`);

program
  .command("source")
  .description("print the search API behind every posting: endpoint, quirks")
  .action(() => sources.describe());

const spend = (command: Command) => command
  .option("--location <where>", "repeatable; 'City, State, Country', spelled out", collect, [])
  .option("--remote", "only jobs a remote worker can hold")
  .option("--since <window>", `one of ${sources.SINCE.join(", ")}`, "7d")
  .option("--max <n>", "jobs returned -- this is the bill", Number, 200)
  .option("--file <path>", "replay a saved dataset instead of spending credit")
  .option("--db <path>");

function replay(database: Database, at: string) {
  const payload = JSON.parse(fs.readFileSync(at, "utf8"));
  const held = sources.fromApify(Array.isArray(payload) ? payload : payload.items ?? []);
  console.log(`REPLAYED ${held.length} postings (${store(database, held)} new)`);
  nextStep(database);
}

const since = (held: string) => {
  if (!(sources.SINCE as readonly string[]).includes(held))
    fail(`--since ${held} is not one of ${sources.SINCE.join(", ")}`);
  return held as sources.Since;
};

const searchable = (value: string) => value.replace(/\([^)]*\)/g, "").trim();

const unwanted = (database: Database) => ({
  notTitles: [...new Set(["title_exclude", "title_noise"]
    .flatMap((kind) => stored(database, kind).flatMap(literals)))],
  notOrganizations: stored(database, "agency_blocklist"),
});

function warnUnkeepable(database: Database, titles: string[]) {
  const include = compilePatterns(stored(database, "title_include"));
  if (!include.length) return;
  const doomed = titles.filter((title) => !matchesAny(include, title));
  if (!doomed.length) return;
  console.log("these titles cannot survive title_include, so every job they return is " +
    `paid for and then dropped: ${doomed.join(", ")}`);
  console.log("  drop them from the title criteria, or widen title_include\n");
}

async function fetched(database: Database, aim: sources.Search, what: string) {
  const held = await sources.search(aim);
  const fresh = store(database, held);
  console.log(`FETCHED ${held.length} postings ${what} (${fresh} new)`);
  nextStep(database);
}

spend(program
  .command("search")
  .description("search every career site by title, descriptions included")
  .option("--title <text>", "repeatable; defaults to your preferred titles", collect, []))
  .action(guard(async (options) => {
    const database = open(options.db);
    if (options.file) return replay(database, options.file);

    let titles: string[] = options.title;
    if (!titles.length)
      titles = (database.prepare(
        "SELECT value FROM search_titles ORDER BY seq IS NULL, seq, value")
        .all() as { value: string }[])
        .map((row) => searchable(row.value))
        .filter((value) => value && value.split(/\s+/).length <= 5);
    if (!titles.length)
      fail("no titles: pass --title, or add rows to search_titles");

    const locations = options.location.length ? options.location : ["United States"];
    warnUnkeepable(database, titles);
    const spared = unwanted(database);
    await fetched(database, {
      titles, organizations: [], locations, ...spared, remote: Boolean(options.remote),
      since: since(options.since), max: options.max,
    }, `for ${titles.length} titles`);
  }));

spend(program
  .command("watchlist")
  .description("every live job at the companies you watch, whatever the title"))
  .action(guard(async (options) => {
    const database = open(options.db);
    if (options.file) return replay(database, options.file);

    const organizations = (database.prepare(
      "SELECT DISTINCT name FROM companies WHERE active=1 ORDER BY name")
      .all() as { name: string }[]).map((row) => row.name);
    if (!organizations.length)
      fail("no companies are active — add some, or run job-scan search instead");

    await fetched(database, {
      titles: [], organizations, locations: options.location,
      notTitles: unwanted(database).notTitles, notOrganizations: [],
      remote: Boolean(options.remote), since: since(options.since), max: options.max,
    }, `at ${organizations.length} watched companies`);
  }));

program
  .command("dispositions")
  .description("every verdict, in the order the chain rules")
  .action(() => {
    console.log("Every verdict a posting can get, in the order the chain rules.\n");
    const width = Math.max(...Object.keys(DISPOSITIONS).map((name) => name.length));
    for (const [name, note] of Object.entries(DISPOSITIONS))
      console.log(`  ${name.padEnd(width)}  ${note}`);
    console.log(`\n  kept${" ".repeat(width - 4)}  NOT A DROP: promoted to prospects`);
    console.log("\nEvery posting keeps its ruling in `postings.disposition`, so what a filter cost");
    console.log("stays queryable after the run. Patterns live in the `filters` table.");
  });

program
  .command("ingest")
  .description("derive prospects from the raw layer; fetches nothing")
  .option("--redo", "rule again on postings already dispositioned, without re-fetching")
  .option("--source <name>", "limit to these sources", collect, [])
  .option("--include-seen", "ignore what is already in prospects")
  .option("--no-location-filter", "see what the location rule is costing")
  .option("--max-age-days <n>", "override the stored age limit for one run", Number)
  .option("--comp-floor <n>", "override identity.compensation_floor for one run", Number)
  .option("--db <path>")
  .action(guard((options) => {
    const database = open(options.db);
    const declared = [...vocabulary(ddl(), "postings", "disposition")].sort();
    const mine = [...Object.keys(DISPOSITIONS), "kept"].sort();
    if (mine.join(",") !== declared.join(","))
      fail("DISPOSITIONS and the schema disagree about what a posting can be ruled");

    const config = loadConfig(database, {
      include_seen: Boolean(options.includeSeen),
      location_filter: options.locationFilter !== false,
      max_age_days: options.maxAgeDays ?? null,
      comp_floor: options.compFloor ?? null,
    });

    const where = options.redo ? "WHERE disposition IS NOT 'kept'" : "WHERE disposition IS NULL";
    let rows = (database.prepare(
      `SELECT ${POSTING_COLUMNS.join(",")} FROM postings ${where}`).all() as unknown[])
      .map((row) => Posting.parse(row));
    if (options.source.length) {
      const wanted = new Set(options.source.map((held: string) => held.toLowerCase()));
      rows = rows.filter((row) => wanted.has(row.source.toLowerCase()));
    }
    if (!rows.length)
      return console.log("nothing pending in postings — fetch first, or pass --redo");

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

    const counts: Record<string, number> = Object.fromEntries(
      Object.keys(DISPOSITIONS).map((name) => [name, 0]));
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

    console.log(`NEW PROSPECTS: ${kept.length}   (from ${rows.length} postings)`);
    const dropped = Object.entries(counts).filter(([, n]) => n);
    if (dropped.length)
      console.log("dropped: " + dropped.map(([name, n]) => `${name} ${n}`).join(" | "));

    const unknown = database.prepare(
      "SELECT company, COUNT(*) n FROM postings WHERE disposition='kept' " +
      "AND ingested_on=date('now') AND lower(company) NOT IN " +
      "(SELECT lower(name) FROM companies) GROUP BY company ORDER BY n DESC")
      .all() as { company: string; n: number }[];
    if (unknown.length) {
      console.log("\ncompanies not on the watchlist:");
      for (const row of unknown)
        console.log(`  ${String(row.n).padStart(2)}  ${row.company}`);
    }
    const { n } = database.prepare(
      "SELECT COUNT(*) n FROM postings WHERE disposition IS NULL").get() as { n: number };
    if (n) console.log(`\n${n} postings still pending`);
  }));

program.parseAsync();
