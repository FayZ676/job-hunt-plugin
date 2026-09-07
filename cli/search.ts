#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import path from "node:path";

import { DOWNLOADS } from "../lib/core/db.ts";
import { CARDS, VIEWJOB } from "../lib/core/indeed.ts";
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
  `Load an Indeed harvest into postings and rule on it. The browser does the searching --
  you drive Indeed, save the cards, and this reads the file. Nothing here touches the network.

  job-search harvest --file indeed-raw.json
  job-search harvest --file indeed-raw.json --not-title intern --not-company Insight
  job-search descriptions --file indeed-descs.json   attach full text to what was kept
  job-search rule --redo                             rule stored postings again
  job-search dispositions                            every verdict, in the order ruled

The cards live at ${CARDS}
on a search results page -- see references/searching.md for the harvest itself.`,
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

program.parseAsync();
