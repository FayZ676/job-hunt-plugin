#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { Command } from "commander";

import { ddl, open } from "../lib/core/db.ts";
import { columns, sections, takes } from "../lib/core/ddl.ts";
import { printRows } from "../lib/core/table.ts";
import { fail, guard } from "./kit.ts";

const FIELDS = () =>
  sections(ddl()).flatMap((section) =>
    columns(ddl(), section).map((column) => `${section}.${column}`));

function split(field: string) {
  if (!FIELDS().includes(field))
    fail(`no such field '${field}' — job-profile missing lists every one that blocks`);
  const [section, column] = field.split(".");
  return { section, column };
}

const program = new Command("job-profile").description("Read and answer the search profile.");

program
  .command("set")
  .description("answer one field, or correct the answer it already has")
  .argument("<section>.<name>")
  .argument("<value>")
  .option("--db <path>")
  .action(guard((field: string, value: string, options) => {
    const { section, column } = split(field);
    const database = open(options.db);
    try {
      database.prepare(`UPDATE ${section} SET ${column}=? WHERE id=1`).run(value.trim());
    } catch {
      fail(`'${value}' is not an answer to ${field} — it takes ${takes(ddl(), section, column)}`);
    }
    console.log(`${field} = ${value}`);
  }));

program
  .command("clear")
  .description("drop an answer — the field goes back to blocking")
  .argument("<section>.<name>")
  .option("--db <path>")
  .action(guard((field: string, options) => {
    const { section, column } = split(field);
    open(options.db).prepare(`UPDATE ${section} SET ${column}=NULL WHERE id=1`).run();
    console.log(`${field} unanswered — it blocks any form that asks for it`);
  }));

program
  .command("answers")
  .description("what the profile answers")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    const rows = open(options.db)
      .prepare("SELECT section, field, value FROM answers WHERE value IS NOT NULL")
      .all() as Record<string, unknown>[];
    printRows(rows, options.json);
  }));

program
  .command("missing")
  .description("every unanswered field — each one blocks")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    const rows = open(options.db)
      .prepare("SELECT field, section FROM unanswered")
      .all() as Record<string, unknown>[];
    printRows(rows, options.json);
    if (rows.length && !options.json)
      console.log(
        `\n${rows.length} unanswered — a form asking for one of these blocks, never guesses`);
  }));

program.parseAsync();
