#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { printRows } from "../lib/core/table.ts";
import { record, rejected, review } from "../lib/submit.ts";
import { phase } from "./kit.ts";

const { program, runs } = phase(
  "job-submit",
  `Phase 5 — present what is staged, submit only what the user names, record it.

  job-submit review                      the approval table: one row per staged application
  job-submit record KEY --confirmation "Application received — #A12"
  job-submit rejected KEY --note "3 days, no interview — resume screen"

Recording an application moves its resume into submitted/ in the same step that
sets \`applied\`; a rejection deletes that file, and checks it did not come back.`,
);

program
  .command("review")
  .description("the approval table the user reads before naming any")
  .option("--json")
  .action(
    runs((options) => {
      const waiting = review();
      printRows(waiting as unknown as Record<string, unknown>[], options.json);
      if (waiting.length && !options.json) {
        const ready = waiting.filter((row) => row.status === "ready").length;
        console.log(`\n${ready} ready. Nothing goes out until the user names it, in this run.`);
      }
    }),
  );

program
  .command("record")
  .description("mark applied and move the resume into submitted/")
  .argument("<key>")
  .requiredOption("--confirmation <text>", "what the confirmation page said — clicking the button is not evidence")
  .action(
    runs((key: string, options) => {
      const done = record(key, options.confirmation);
      console.log(`${key}  applied`);
      console.log(`  resume  ${done.resume}`);
      console.log(`  saw     ${done.confirmation}`);
    }),
  );

program
  .command("rejected")
  .description("record a reported rejection and delete its resume")
  .argument("<key>")
  .requiredOption("--note <text>")
  .action(
    runs((key: string, options) => {
      const gone = rejected(key, options.note);
      console.log(`${key}  rejected`);
      for (const held of gone.deleted) console.log(`  deleted ${held}`);
      if (gone.stubborn.length) {
        console.log("\na synced folder keeps re-materializing these — delete them by hand:");
        for (const held of gone.stubborn) console.log(`  ${held}`);
        process.exit(1);
      }
    }),
  );

program.parseAsync();
