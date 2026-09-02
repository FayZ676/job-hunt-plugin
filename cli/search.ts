#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import { DEFAULTS, DISPOSITIONS, type Found, type Ruled, replay, rule, search } from "../lib/search.ts";
import * as sources from "../lib/core/sources.ts";
import { collect, fail, phase } from "./kit.ts";

const dropped = (counts: Record<string, number>) =>
  Object.entries(counts)
    .filter(([, n]) => n)
    .map(([name, n]) => `${name} ${n}`)
    .join(" | ");

function ruled(held: Ruled) {
  console.log(`NEW PROSPECTS: ${held.kept}   (from ${held.examined} ruled)`);
  const drops = dropped(held.counts);
  if (drops) console.log(`dropped: ${drops}`);
  if (held.pending) console.log(`\n${held.pending} postings still pending`);
}

function report(found: Found) {
  if (found.unkeepable.length) {
    console.log(
      "these cannot survive title_include, so every job they return is " +
        `paid for and then dropped: ${found.unkeepable.join(", ")}`,
    );
    console.log("  drop them, or widen title_include\n");
  }
  console.log(`FETCHED ${found.fetched} postings (${found.fresh} new)`);
  ruled(found);
}

const { program, runs } = phase(
  "job-search",
  `Phase 1 — find the openings. One paid call, then every rule the filters carry.

  job-search "AI Engineer"                  across every career site
  job-search "AI Engineer" --location "Oregon, United States"
  job-search "AI Engineer" --remote --since 24h
  job-search rule --redo --no-location-filter   rule stored postings again, no network
  job-search dispositions                   every verdict, in the order ruled`,
);

const since = (held: string) => {
  if (!(sources.SINCE as readonly string[]).includes(held))
    fail(`--since ${held} is not one of ${sources.SINCE.join(", ")}`);
  return held as sources.Since;
};

program
  .argument("[role...]", "what to search for, short and literal")
  .option("--location <where>", "repeatable; 'City, State, Country', spelled out", collect, [])
  .option("--remote", "only jobs a remote worker can hold")
  .option("--since <window>", `one of ${sources.SINCE.join(", ")}`, DEFAULTS.since)
  .option("--max <n>", "jobs returned -- this is the bill", Number, DEFAULTS.max)
  .option("--file <path>", "replay a saved dataset instead of spending credit")
  .action(
    runs(async (terms: string[], options) => {
      if (options.file) return report(replay(JSON.parse(fs.readFileSync(options.file, "utf8"))));
      if (!terms.length) fail("name what to search for, short and literal; `job-score instructions` says what");

      report(
        await search({
          terms,
          locations: options.location,
          remote: Boolean(options.remote),
          since: since(options.since),
          max: options.max,
        }),
      );
    }),
  );

program
  .command("dispositions")
  .description("every verdict, in the order the chain rules")
  .action(() => {
    console.log("Every verdict a posting can get, in the order the chain rules.\n");
    const width = Math.max(...Object.keys(DISPOSITIONS).map((name) => name.length));
    for (const [name, note] of Object.entries(DISPOSITIONS)) console.log(`  ${name.padEnd(width)}  ${note}`);
    console.log(`\n  kept${" ".repeat(width - 4)}  NOT A DROP: promoted to prospects`);
    console.log("\nEvery posting keeps its ruling in `postings.disposition`, so what a filter cost");
    console.log("stays queryable after the run. Patterns live in the `filters` table.");
  });

program
  .command("rule")
  .description("rule stored postings again; fetches nothing")
  .option("--redo", "rule again on postings already dispositioned")
  .option("--include-seen", "ignore what is already in prospects")
  .option("--no-location-filter", "see what the location rule is costing")
  .option("--max-age-days <n>", "override the stored age limit for one run", Number)
  .option("--comp-floor <n>", "override identity.compensation_floor for one run", Number)
  .action(
    runs((options) => {
      const held = rule({
        redo: Boolean(options.redo),
        include_seen: Boolean(options.includeSeen),
        location_filter: options.locationFilter !== false,
        max_age_days: options.maxAgeDays ?? null,
        comp_floor: options.compFloor ?? null,
      });

      if (!held.examined) return console.log("nothing pending in postings — search first, or pass --redo");
      ruled(held);
    }),
  );

program.parseAsync();
