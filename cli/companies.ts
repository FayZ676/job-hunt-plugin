#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";

import { discover, forget, listed, remember } from "../lib/companies.ts";
import { fetchers } from "../lib/core/fetch/index.ts";
import { pool } from "../lib/core/fetch/net.ts";
import { action, fail } from "./kit.ts";

const { program, runs } = action(
  "job-companies",
  `Whose career sites job-search crawls. Every board is read straight off the employer's
  ATS -- no key, no quota, no bill -- so the only limit on a search is who is listed here.

  job-companies add anthropic                       probe every ATS for that name
  job-companies add https://jobs.lever.co/matchgroup --name "Match Group"
  job-companies add --file employers.txt            one name or URL per line
  job-companies list
  job-companies remove Anthropic
  job-companies fetchers                            the ATSes currently plugged in`,
);

const NAMES = 6;

async function adds(asked: string[], name: string | undefined) {
  const found = await pool(asked, NAMES, async (said) => ({ said, boards: await discover(said) }));
  let added = 0;
  for (const { said, boards } of found) {
    if (!boards.length) {
      console.log(`no board found for ${said}`);
      continue;
    }
    for (const held of boards) {
      remember({ ...held, name: name ?? held.name });
      console.log(`added ${held.ats}:${held.board} as ${name ?? held.name}`);
      added += 1;
    }
  }
  return added;
}

program
  .command("add", { isDefault: true })
  .argument("[who...]", "a name, an ATS board slug, or a careers URL")
  .option("--name <name>", "what to call the employer, when the board does not say")
  .option("--file <path>", "one name or URL per line")
  .description("probe every plugged-in ATS and register the boards that answer")
  .action(
    runs(async (who: string[], options) => {
      const asked = options.file
        ? fs
            .readFileSync(options.file, "utf8")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#"))
        : who;
      if (!asked.length) fail("name an employer, a board slug, or a careers URL");
      if (options.name && asked.length > 1) fail("--name describes one employer; add them one at a time");

      const added = await adds(asked, options.name);
      console.log(`\n${added} board${added === 1 ? "" : "s"} registered`);
    }),
  );

program
  .command("list")
  .description("every registered career site")
  .action(
    runs(() => {
      const held = listed();
      if (!held.length) return console.log("nothing registered — job-companies add <name, slug, or careers URL>");
      const width = Math.max(...held.map((one) => one.name.length));
      for (const one of held)
        console.log(`  ${one.name.padEnd(width)}  ${one.ats}:${one.board}  ${one.last_crawled ?? "never crawled"}`);
      console.log(`\n${held.length} career sites`);
    }),
  );

program
  .command("remove")
  .argument("<who>", "the employer's name, or its board")
  .description("stop crawling an employer")
  .action(
    runs((who: string) => {
      const gone = forget(who);
      if (!gone) fail(`nothing registered under ${who}`);
      console.log(`removed ${gone} board${gone === 1 ? "" : "s"}`);
    }),
  );

program
  .command("fetchers")
  .description("the ATS modules currently plugged in")
  .action(
    runs(async () => {
      const held = await fetchers();
      const width = Math.max(...held.map((one) => one.id.length));
      for (const one of held) console.log(`  ${one.id.padEnd(width)}  ${one.takes}`);
      console.log("\nEach is one file in lib/core/fetch/ats. Delete it and that ATS is gone;");
      console.log("drop a new one in and it is crawled on the next search.");
    }),
  );

program.parseAsync();
