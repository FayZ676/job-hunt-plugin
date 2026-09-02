#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { Command } from "commander";

import { open } from "../lib/core/db.ts";
import { printRows } from "../lib/core/table.ts";
import {
  instructions,
  prospect,
  record,
  triage,
  unscored,
} from "../lib/score.ts";
import { guard } from "./kit.ts";

const program = new Command("job-score")
  .description(
    `Phase 2 — score every prospect against the search profile.

  job-score triage                        the cheap list: no descriptions, on purpose
  job-score triage --status new
  job-score instructions                  the profile facts and prose scoring reads
  job-score show KEY [KEY ...]            full text, for survivors only
  job-score set KEY --score 9 --reason "the JD language that drove it, quoted"
  job-score pending                       what is still unscored and will come back tomorrow

A score sets the status by the threshold in settings, so the two cannot disagree.`,
  )
  .option("--db <path>");

program
  .command("triage")
  .description("the triage view: no descriptions, on purpose")
  .option("--status <status>")
  .option("--limit <n>", "", Number)
  .option("--json")
  .action(
    guard((options) => {
      open(program.opts().db);
      printRows(triage(options), options.json);
    }),
  );

program
  .command("instructions")
  .description(
    "everything scoring reads: standing profile facts, then the instructions",
  )
  .action(
    guard((options) => {
      open(program.opts().db);
      const { standing, text } = instructions();
      if (standing.length) {
        console.log("From the profile, and not up for debate:");
        for (const line of standing) console.log(`- ${line}`);
        console.log("");
      }
      console.log(text ?? "(nothing written down)");
    }),
  );

program
  .command("show")
  .description("full description for the prospects that survived triage")
  .argument("<key...>")
  .action(
    guard((keys: string[], options) => {
      open(program.opts().db);
      for (const key of keys) {
        const row = prospect(key);
        if (!row) {
          console.error(`no prospect '${key}'`);
          continue;
        }
        console.log(`${row.company} — ${row.title}  [${row.key}]`);
        console.log(
          `  ${row.location || "(no location)"}` +
            `${row.remote ? "  remote" : ""}` +
            `${row.compensation ? "  " + row.compensation : ""}`,
        );
        console.log(
          `  posted ${row.posted_at || "unknown"}   ${row.status}` +
            `${row.score !== null ? "  score " + row.score : ""}`,
        );
        console.log(`  ${row.url || ""}\n`);
        console.log(
          row.description ||
            "(no description — job-score set will refuse this one)",
        );
        console.log("\n" + "-".repeat(78) + "\n");
      }
    }),
  );

program
  .command("set")
  .description("record a score and the reason that drove it")
  .argument("<key>")
  .requiredOption("--score <n>", "", Number)
  .requiredOption("--reason <text>")
  .action(
    guard((key: string, options) => {
      open(program.opts().db);
      const after = record(key, Number(options.score), options.reason);
      console.log(`${key}  ${after.score}  ${after.status}`);
    }),
  );

program
  .command("pending")
  .description("prospects with no score yet")
  .option("--json")
  .action(
    guard((options) => {
      open(program.opts().db);
      const rows = unscored();
      printRows(rows, options.json);
      if (rows.length && !options.json)
        console.log(
          `\n${rows.length} unscored — each one stays \`new\` and comes back tomorrow`,
        );
    }),
  );

program.parseAsync();
