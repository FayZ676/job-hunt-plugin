#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { Command } from "commander";

import { open } from "../lib/core/db.ts";
import { printRows } from "../lib/core/table.ts";
import { answers, clear, missing, set } from "../lib/profile.ts";
import { guard } from "./kit.ts";

const program = new Command("job-profile").description("Read and answer the search profile.");

program
  .command("set")
  .description("answer one field, or correct the answer it already has")
  .argument("<section>.<name>")
  .argument("<value>")
  .option("--db <path>")
  .action(guard((field: string, value: string, options) => {
    set(open(options.db), field, value);
    console.log(`${field} = ${value}`);
  }));

program
  .command("clear")
  .description("drop an answer — the field goes back to blocking")
  .argument("<section>.<name>")
  .option("--db <path>")
  .action(guard((field: string, options) => {
    clear(open(options.db), field);
    console.log(`${field} unanswered — it blocks any form that asks for it`);
  }));

program
  .command("answers")
  .description("what the profile answers")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    printRows(answers(open(options.db)), options.json);
  }));

program
  .command("missing")
  .description("every unanswered field — each one blocks")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    const rows = missing(open(options.db));
    printRows(rows, options.json);
    if (rows.length && !options.json)
      console.log(
        `\n${rows.length} unanswered — a form asking for one of these blocks, never guesses`);
  }));

program.parseAsync();
