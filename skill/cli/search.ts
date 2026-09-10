#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import path from "node:path";

import { DOWNLOADS } from "../lib/core/db.ts";
import { CARDS, VIEWJOB } from "../lib/core/indeed.ts";
import { crawl, descriptions } from "../lib/crawl.ts";
import { DISPOSITIONS, type Harvested, type Ruled, describe, harvest, rule } from "../lib/search.ts";
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

function report(held: Harvested) {
  console.log(`READ ${held.read} cards, stored ${held.stored} (${held.fresh} new)`);
  if (held.dropped) console.log(`excluded before storing: ${held.dropped}`);
  ruled(held);
}

const read = (named: string) => {
  const tried = [named, path.join(DOWNLOADS, path.basename(named))];
  const at = tried.find((held) => fs.existsSync(held));
  if (!at) fail(`no harvest at ${tried.join(" or ")}`);
  try {
    return JSON.parse(fs.readFileSync(at, "utf8"));
  } catch (error) {
    fail(`${at} is not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const { program, runs } = action(
  "job-search",
  `Search Indeed and rule on what comes back.

  job-search run --queries queries.txt                search, rule, then fetch every description
  job-search run --query '<url>' --not-title intern   the same, queries given inline
  job-search run --limit 100                          no queries: only finish missing descriptions
  job-search rule --redo                              rule stored postings again
  job-search dispositions                             every verdict, in the order ruled

  job-search harvest --file indeed-raw.json           read cards you saved out of the browser yourself
  job-search descriptions --file indeed-descs.json    attach descriptions the same way

\`run\` drives the browser \`job-browser\` leaves running and prints a line per page,
writing each description to the database as it lands -- so a run that is cut short
keeps everything it fetched, and running it again picks up the rest.

The cards live at ${CARDS}
on a search results page -- see references/searching.md for the queries themselves.`,
);

program
  .command("harvest")
  .description("read a saved Indeed harvest into postings, then rule on it")
  .requiredOption("--file <path>", "the harvest JSON saved out of the browser")
  .option("--not-title <word>", "repeatable; a title word to drop before storing", collect, [])
  .option("--not-company <name>", "repeatable; an employer to drop before storing", collect, [])
  .action(
    runs((options) => {
      report(
        harvest(read(options.file), {
          notTitles: options.notTitle,
          notCompanies: options.notCompany,
        }),
      );
    }),
  );

program
  .command("descriptions")
  .description("attach full descriptions, harvested from the posting pages, to kept rows")
  .requiredOption("--file <path>", "[{jobkey, description}, ...] saved out of the browser")
  .action(
    runs((options) => {
      const held = describe(read(options.file));
      console.log(`READ ${held.read} descriptions, attached ${held.attached}`);
      if (!held.missing.length) return;
      console.log(`\n${held.missing.length} kept postings still have no description — job-score set refuses these:`);
      for (const row of held.missing)
        console.log(`  ${row.key}  ${row.company} — ${row.title}  ${row.url ?? VIEWJOB + row.key.split(":")[1]}`);
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
  .description("rule stored postings again; reads nothing new")
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

      if (!held.examined) return console.log("nothing pending in postings — harvest first, or pass --redo");
      ruled(held);
    }),
  );

const queriesFrom = (inline: string[], file: string | undefined) => {
  if (!file) return inline;
  const raw = fs.readFileSync(file, "utf8").trim();
  const held = raw.startsWith("[") ? JSON.parse(raw) : raw.split("\n");
  return [...inline, ...held.map((one: string) => one.trim()).filter((one: string) => one && !one.startsWith("#"))];
};

program
  .command("run")
  .description("search Indeed in the browser, rule what came back, then fetch every missing description")
  .option("--query <url>", "repeatable; an Indeed search URL to navigate", collect, [])
  .option("--queries <path>", "a file of search URLs, one per line or a JSON array")
  .option("--not-title <word>", "repeatable; a title word to drop before storing", collect, [])
  .option("--not-company <name>", "repeatable; an employer to drop before storing", collect, [])
  .option("--limit <n>", "stop after this many descriptions, and say how many are left", Number)
  .action(
    runs(async (options) => {
      const queries = queriesFrom(options.query, options.queries);
      const harvested = await crawl(queries, { notTitles: options.notTitle, notCompanies: options.notCompany });
      if (harvested) report(harvested);

      const held = await descriptions(options.limit ?? null);
      console.log(`DESCRIPTIONS: fetched ${held.fetched}, ${held.missing} still missing`);
      if (held.missing) console.log("run again to fetch the rest");
    }),
  );

program.parseAsync();
