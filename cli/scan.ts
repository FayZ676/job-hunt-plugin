#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import { Command } from "commander";
import type { Database } from "better-sqlite3";

import { open } from "../lib/core/db.ts";
import { DISPOSITIONS, ingest, patterns } from "../lib/phases/scan.ts";
import { POSTING_COLUMNS, Posting } from "../lib/core/posting.ts";
import * as sources from "../lib/core/sources.ts";
import { compilePatterns, literals, matchesAny } from "../lib/core/text.ts";
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

const program = new Command("job-scan").description(
  `Phase 1 — fetch postings, then rule on them. Two steps, and they stay separate.

  job-scan search                           your preferred titles across every career site
  job-scan search --title "AI Engineer" --location "Oregon, United States"
  job-scan search --remote --since 24h      only what a remote worker can hold
  job-scan ingest                           postings into prospects, no network
  job-scan ingest --redo --no-location-filter
  job-scan dispositions                     every verdict, in the order ruled`);

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
    .flatMap((kind) => patterns(database, kind).flatMap(literals)))],
  notOrganizations: patterns(database, "agency_blocklist"),
});

function warnUnkeepable(database: Database, titles: string[]) {
  const include = compilePatterns(patterns(database, "title_include"));
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
      titles, locations, ...spared, remote: Boolean(options.remote),
      since: since(options.since), max: options.max,
    }, `for ${titles.length} titles`);
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
  .option("--include-seen", "ignore what is already in prospects")
  .option("--no-location-filter", "see what the location rule is costing")
  .option("--max-age-days <n>", "override the stored age limit for one run", Number)
  .option("--comp-floor <n>", "override identity.compensation_floor for one run", Number)
  .option("--db <path>")
  .action(guard((options) => {
    const database = open(options.db);
    const ruled = ingest(database, {
      redo: Boolean(options.redo),
      include_seen: Boolean(options.includeSeen),
      location_filter: options.locationFilter !== false,
      max_age_days: options.maxAgeDays ?? null,
      comp_floor: options.compFloor ?? null,
    });

    if (!ruled.examined)
      return console.log("nothing pending in postings — fetch first, or pass --redo");

    console.log(`NEW PROSPECTS: ${ruled.kept}   (from ${ruled.examined} postings)`);
    const dropped = Object.entries(ruled.counts).filter(([, n]) => n);
    if (dropped.length)
      console.log("dropped: " + dropped.map(([name, n]) => `${name} ${n}`).join(" | "));

    if (ruled.pending) console.log(`\n${ruled.pending} postings still pending`);
  }));

program.parseAsync();
