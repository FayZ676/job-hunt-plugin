#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { printRows } from "../lib/core/table.ts";
import { answers, clear, missing, set } from "../lib/profile.ts";
import { action } from "./kit.ts";

const { program, runs } = action("job-profile", "Read and answer the search profile.");

program
  .command("set")
  .description("answer one field, or correct the answer it already has")
  .argument("<section>.<name>")
  .argument("<value>")
  .action(
    runs((field: string, value: string, options) => {
      set(field, value);
      console.log(`${field} = ${value}`);
    }),
  );

program
  .command("clear")
  .description("drop an answer — the field goes back to blocking")
  .argument("<section>.<name>")
  .action(
    runs((field: string, options) => {
      clear(field);
      console.log(`${field} unanswered — it blocks any form that asks for it`);
    }),
  );

program
  .command("answers")
  .description("what the profile answers")
  .option("--json")
  .action(
    runs((options) => {
      printRows(answers(), options.json);
    }),
  );

program
  .command("missing")
  .description("every unanswered field — each one blocks")
  .option("--json")
  .action(
    runs((options) => {
      const rows = missing();
      printRows(rows, options.json);
      if (rows.length && !options.json)
        console.log(`\n${rows.length} unanswered — a form asking for one of these blocks, never guesses`);
    }),
  );

program.parseAsync();
