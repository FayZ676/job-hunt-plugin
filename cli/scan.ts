#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import { Command } from "commander";
import type { Database } from "better-sqlite3";

import { ddl, open } from "../lib/db.ts";
import { POSTING_COLUMNS, Posting } from "../lib/posting.ts";
import { vocabulary } from "../lib/schema.ts";
import * as sources from "../lib/sources.ts";
import {
  ageDays, compilePatterns, matchesAny, norm, normCompany,
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
    "  sponsored=excluded.sponsored, expired=excluded.expired," +
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

async function pooled<T>(items: T[], workers: number, run: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item);
  }));
}

const DISPOSITIONS: Record<string, string> = {
  sponsored: "paid placements -- almost entirely gig spam and unrelated listings",
  expired: "dead listings still in an index, including an unlisted Ashby posting",
  agency: "reposters and body shops, by `agency_blocklist` name or `agency_name_patterns`",
  noise: "`title_noise` -- AI Trainer, annotation, tutoring, freelance-gig phrasing",
  lowball:
    "a STATED YEARLY band topping out below `comp_floor`; per-hour or unstated is not judged",
  title: "fails `title_include`, or matches `title_exclude`",
  location:
    "fails `location_include`, or matches `location_exclude` with no US anchor; " +
    "remote skips the include test",
  stale: "older than `max_age_days`",
  covered: "a better-ranked source already covers this company",
  seen: "already kept, or already collapsed into a kept row, by key or company + title",
  duplicate: "one role listed in several places, collapsed into the row that was kept",
  upgraded: "NOT A DROP: a better-ranked source replaced the source on an existing prospect",
};

const CARRIED = ["first_seen", "score", "reason", "resume", "status"];
const MERGED = ["description", "compensation"];

const PATTERN_KINDS = ["title_include", "title_exclude", "location_include", "location_exclude",
  "us_tokens", "title_noise", "agency_name_patterns"] as const;

type Config = {
  include_seen: boolean; keep_covered: boolean; location_filter: boolean;
  max_age_days: number; comp_floor: number;
  agency_blocklist: Set<string>;
} & Record<(typeof PATTERN_KINDS)[number], RegExp[]>;

type Options = {
  include_seen: boolean; keep_covered: boolean; location_filter: boolean;
  max_age_days: number | null; comp_floor: number | null;
};

function loadConfig(database: Database, options: Options): Config {
  const settings = Object.fromEntries(
    (database.prepare("SELECT key,value FROM settings").all() as { key: string; value: string }[])
      .map((row) => [row.key, row.value]));

  const floor = database.prepare("SELECT compensation_floor FROM identity")
    .get() as { compensation_floor: number | null } | undefined;

  const patterns = (kind: string) =>
    compilePatterns((database.prepare("SELECT pattern FROM filters WHERE kind=?")
      .all(kind) as { pattern: string }[]).map((row) => row.pattern));

  return {
    ...options,
    ...Object.fromEntries(PATTERN_KINDS.map((kind) => [kind, patterns(kind)])),
    agency_blocklist: new Set(
      (database.prepare("SELECT pattern FROM filters WHERE kind='agency_blocklist'")
        .all() as { pattern: string }[]).map((row) => normCompany(row.pattern))),
    max_age_days: options.max_age_days ?? Number(settings.max_age_days ?? 30),
    comp_floor: options.comp_floor ?? Number(floor?.compensation_floor ?? 0),
  } as Config;
}

const belowCompFloor = (row: Posting, floor: number) => {
  if (!floor || row.comp_period !== "YEARLY") return false;
  const top = row.comp_max ?? row.comp_min;
  return Boolean(top) && (top as number) < floor;
};

type Holder = { key: string; status: string | null; rank: number };

const paired = (company: string, title: string) => `${normCompany(company)} ${norm(title)}`;

function verdict(
  row: Posting, config: Config, seenKeys: Set<string>,
  held: Map<string, Holder>, covered: Map<string, number>,
): [string | null, string | null] {
  const { title, company } = row;
  const location = row.location || "";

  if (row.sponsored) return ["sponsored", null];
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

  if (!config.keep_covered &&
      (covered.get(normCompany(company)) ?? 99) < sources.rank(row.source))
    return ["covered", null];

  if (!config.include_seen) {
    if (seenKeys.has(row.key)) return ["seen", null];
    const holder = held.get(paired(company, title));
    if (holder) {
      if (sources.rank(row.source) < holder.rank &&
          (holder.status === "new" || holder.status === "scored"))
        return ["upgraded", holder.key];
      return ["seen", holder.key];
    }
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
      sources.rank(one.source) - sources.rank(two.source) ||
      Number(!one.remote) - Number(!two.remote) ||
      one.key.localeCompare(two.key));
    const [primary, ...siblings] = group;
    dupes.push(...siblings);
    kept.push([primary, siblings.map((row) => row.key)]);
  }
  return { kept, dupes };
}

function promote(database: Database, oldKey: string, newKey: string) {
  const old = database.prepare("SELECT * FROM postings WHERE key=?")
    .get(oldKey) as Record<string, unknown>;
  database.prepare(
    "UPDATE postings SET disposition='kept', canonical_key=NULL, ingested_on=date('now')," +
    "  last_seen=date('now'), " + CARRIED.map((c) => `${c}=?`).join(", ") + ", " +
    MERGED.map((c) => `${c}=COALESCE(${c},?)`).join(", ") + " WHERE key=?")
    .run([...[...CARRIED, ...MERGED].map((column) => old[column]), newKey]);
  database.prepare(
    "UPDATE postings SET disposition='upgraded', canonical_key=?, ingested_on=date('now')," +
    "  last_seen=NULL, " + CARRIED.map((c) => `${c}=NULL`).join(", ") + " WHERE key=?")
    .run(newKey, oldKey);
  for (const table of ["events", "staged", "staged_fields"])
    database.prepare(`UPDATE ${table} SET key=? WHERE key=?`).run(newKey, oldKey);
  database.prepare("UPDATE postings SET canonical_key=? WHERE canonical_key=?")
    .run(newKey, oldKey);
}

const program = new Command("job-scan").description(
  `Phase 1 — fetch postings, then rule on them. Two steps, and they stay separate.

  job-scan sources                          the registry: kind, rank, endpoint
  job-scan boards                           every active board, in parallel
  job-scan boards --company Anthropic       one board, for testing a new slug
  job-scan indeed                           Apify search on your preferred titles
  job-scan indeed --query "AI engineer" --location Remote --max 50
  job-scan ingest                           postings into prospects, no network
  job-scan ingest --redo --no-location-filter
  job-scan dispositions                     every verdict, in the order ruled`);

program
  .command("sources")
  .description("print the source registry: kind, rank, endpoint, quirks")
  .action(() => sources.describe());

program
  .command("boards")
  .description("fetch every active board source over HTTP")
  .option("--company <name>", "limit to these company names or slugs", collect, [])
  .option("--workers <n>", "", Number, 8)
  .option("--db <path>")
  .action(guard(async (options) => {
    const database = open(options.db);
    let companies = (database.prepare(
      "SELECT name, ats, slug FROM companies WHERE active=1 ORDER BY name")
      .all() as sources.Company[]).filter((company) => company.ats in sources.BOARDS);
    if (options.company.length) {
      const wanted = new Set(options.company.map((held: string) => held.toLowerCase()));
      companies = companies.filter((company) =>
        wanted.has(company.name.toLowerCase()) || wanted.has(company.slug.toLowerCase()));
    }
    if (!companies.length)
      fail("No active companies matched. Seed the database or add companies to it.");

    const failures: [string, string][] = [];
    const fetched: Posting[] = [];
    await pooled(companies, options.workers, async (company) => {
      try {
        fetched.push(...await sources.BOARDS[company.ats](company));
      } catch (error) {
        failures.push([company.name, error instanceof Error
          ? `${error.name}: ${error.message}` : String(error)]);
      }
    });

    const fresh = store(database, fetched);
    console.log(
      `FETCHED ${fetched.length} postings from ${companies.length} boards (${fresh} new)`);
    if (failures.length) {
      console.log("\nboards that failed (likely a wrong slug or a board that moved ATS):");
      for (const [name, error] of failures) console.log(`  - ${name}: ${error}`);
    }
    nextStep(database);
  }));

program
  .command("indeed")
  .description("search Indeed through Apify, descriptions included")
  .option("--query <text>", "repeatable; defaults to your preferred titles", collect, [])
  .option("--location <where>", "", "Remote")
  .option("--country <code>", "", "US")
  .option("--max <n>", "listings per query -- this is the bill", Number, 50)
  .option("--workers <n>", "", Number, 3)
  .option("--file <path>", "replay a saved Apify dataset instead of spending credit")
  .option("--db <path>")
  .action(guard(async (options) => {
    const database = open(options.db);
    if (options.file) {
      const payload = JSON.parse(fs.readFileSync(options.file, "utf8"));
      const replayed = sources.fromApify(Array.isArray(payload) ? payload : payload.items ?? []);
      console.log(`REPLAYED ${replayed.length} indeed postings (${store(database, replayed)} new)`);
      return nextStep(database);
    }

    let queries: string[] = options.query;
    if (!queries.length)
      queries = (database.prepare(
        "SELECT value FROM search_criteria WHERE kind='title_preferred' ORDER BY seq, value")
        .all() as { value: string }[]).map((row) => row.value);
    if (!queries.length)
      fail("no queries: pass --query, or add title_preferred rows to search_criteria");

    const failures: [string, string][] = [];
    const fetched: Posting[] = [];
    await pooled(queries, options.workers, async (query) => {
      try {
        fetched.push(...await (sources.REGISTRY.indeed.fetch as
          (search: sources.Search) => Promise<Posting[]>)({
            query, location: options.location, country: options.country, max: options.max,
          }));
      } catch (error) {
        failures.push([query, error instanceof Error
          ? `${error.name}: ${error.message}` : String(error)]);
      }
    });

    const fresh = store(database, fetched);
    console.log(
      `FETCHED ${fetched.length} indeed postings from ${queries.length} queries (${fresh} new)`);
    if (failures.length) {
      console.log("\nqueries that failed:");
      for (const [query, error] of failures) console.log(`  - ${query}: ${error}`);
    }
    nextStep(database);
  }));

program
  .command("dispositions")
  .description("every verdict, in the order the chain rules")
  .action(() => {
    console.log("Every verdict a posting can get, in the order the chain rules.\n" +
      "Each filter applies to every source.\n");
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
  .option("--keep-covered",
    "keep postings whose company a higher-precedence source already covers")
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
      keep_covered: Boolean(options.keepCovered),
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
      "SELECT key, company, title, source, status FROM postings WHERE disposition='kept'")
      .all() as { key: string; company: string; title: string; source: string; status: string }[];
    const pinned = new Set(live.map((row) => row.key));
    const seenKeys = config.include_seen ? new Set<string>() : new Set([
      ...pinned,
      ...(database.prepare("SELECT key FROM postings WHERE canonical_key IS NOT NULL")
        .all() as { key: string }[]).map((row) => row.key),
    ]);
    const held = new Map<string, Holder>();
    if (!config.include_seen)
      for (const row of live)
        held.set(paired(row.company, row.title),
          { key: row.key, status: row.status, rank: sources.rank(row.source) });
    const covered = new Map<string, number>();
    for (const row of database.prepare("SELECT name, ats FROM companies WHERE active=1")
      .all() as { name: string; ats: string }[])
      if (row.ats in sources.REGISTRY) covered.set(normCompany(row.name), sources.rank(row.ats));

    const counts: Record<string, number> = Object.fromEntries(
      Object.keys(DISPOSITIONS).map((name) => [name, 0]));
    const survivors: Posting[] = [];
    const dispositions: [string, string | null, string][] = [];
    const upgrades: [Posting, string][] = [];

    for (const row of [...rows].sort((one, two) =>
      sources.rank(one.source) - sources.rank(two.source))) {
      const [ruling, target] = verdict(row, config, seenKeys, held, covered);
      if (ruling === "upgraded") {
        upgrades.push([row, target as string]);
        counts.upgraded += 1;
        held.set(paired(row.company, row.title),
          { key: row.key, status: "new", rank: sources.rank(row.source) });
      } else if (ruling) {
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
      for (const [row, target] of upgrades) promote(database, target, row.key);
    })();

    console.log(`NEW PROSPECTS: ${kept.length}   (from ${rows.length} postings)`);
    if (upgrades.length)
      console.log(`upgraded ${upgrades.length} to a better-ranked source`);
    const dropped = Object.entries(counts).filter(([name, n]) => n && name !== "upgraded");
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
