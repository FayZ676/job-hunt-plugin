#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import { DISPOSITIONS, type Found, type Ruled, replay, rule, search } from "../lib/search.ts";
import * as sources from "../lib/core/sources.ts";
import { collect, fail, action } from "./kit.ts";

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
  console.log(`FETCHED ${found.fetched} postings (${found.fresh} new)`);
  ruled(found);
}

const { program, runs } = action(
  "job-search",
  `Find the openings. One paid call, then every rule the profile and settings carry.

  job-search "AI Engineer" --since 7d --max 200    across every career site
  job-search "AI Engineer" --since 7d --location "Oregon, United States"
  job-search "AI Engineer" --since 24h --remote
  job-search "AI Engineer" --since 7d --not-title intern --not-company Insight
  job-search rule --redo          rule stored postings again, no network
  job-search dispositions         every verdict, in the order ruled`,
);

const since = (held: string | undefined) => {
  if (!held) fail(`say how far back this call reaches: --since ${sources.SINCE.join(" | ")}`);
  if (!(sources.SINCE as readonly string[]).includes(held))
    fail(`--since ${held} is not one of ${sources.SINCE.join(", ")}`);
  return held as sources.Since;
};

program
  .argument("[role...]", "what to search for, short and literal")
  .option("--location <where>", "repeatable; 'City, State, Country', spelled out", collect, [])
  .option("--not-title <word>", "repeatable; a title word the search must not return", collect, [])
  .option("--not-company <name>", "repeatable; an employer the search must not return", collect, [])
  .option("--remote", "only jobs a remote worker can hold")
  .option("--since <window>", `how far back this call reaches: one of ${sources.SINCE.join(", ")}`)
  .option("--max <n>", "jobs returned -- this is the bill", Number)
  .option("--file <path>", "replay a saved dataset instead of spending credit")
  .action(
    runs(async (terms: string[], options) => {
      if (options.file) return report(replay(JSON.parse(fs.readFileSync(options.file, "utf8"))));
      if (!terms.length) fail("name what to search for, short and literal; `job-score instructions` says what");

      report(
        await search({
          terms,
          notTitles: options.notTitle,
          notOrganizations: options.notCompany,
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
    console.log("\nEvery posting keeps its ruling in `postings.disposition`, so what a rule cost");
    console.log("stays queryable after the run.");
  });

program
  .command("rule")
  .description("rule stored postings again; fetches nothing")
  .option("--redo", "rule again on postings already dispositioned")
  .option("--include-seen", "ignore what is already in prospects")
  .option("--max-age-days <n>", "override the stored age limit for one run", Number)
  .option("--comp-floor <n>", "override identity.compensation_floor for one run", Number)
  .action(
    runs((options) => {
      const held = rule({
        redo: Boolean(options.redo),
        include_seen: Boolean(options.includeSeen),
        max_age_days: options.maxAgeDays ?? null,
        comp_floor: options.compFloor ?? null,
      });

      if (!held.examined) return console.log("nothing pending in postings — search first, or pass --redo");
      ruled(held);
    }),
  );

program.parseAsync();
