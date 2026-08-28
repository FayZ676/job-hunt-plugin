#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import { Command } from "commander";

import { ddl, open } from "../lib/db.ts";
import { dump } from "../lib/dump.ts";
import { printRows } from "../lib/table.ts";
import { fail, guard } from "./kit.ts";

const READS = new Set(["SELECT", "WITH", "PRAGMA", "EXPLAIN", "VALUES"]);

new Command("job-q")
  .description(`Run SQL against the job database.

  job-q "SELECT * FROM triage WHERE status='new'"
  job-q --json "SELECT * FROM triage LIMIT 5"
  job-q -f some.sql          run a file
  job-q --schema             print the schema
  job-q --export > job.sql   dump everything as portable SQL`)
  .argument("[sql]")
  .option("-f, --file <path>", "run a .sql file instead")
  .option("--json", "print rows as JSON")
  .option("--schema", "print the schema and exit")
  .option("--export", "dump the whole database as SQL you can take anywhere")
  .option("--db <path>")
  .action(guard((sql: string | undefined, options) => {
    if (options.schema) return console.log(ddl());

    const database = open(options.db);
    if (options.export) {
      for (const line of dump(database)) console.log(line);
      return;
    }

    if (options.file) {
      database.exec(fs.readFileSync(options.file, "utf8"));
      return console.log(`ran ${options.file}`);
    }
    if (!sql) fail("give SQL, or -f FILE, or --schema");

    const first = sql.trim().split(/\s+/)[0].toUpperCase();
    let rows: Record<string, unknown>[];
    if (READS.has(first)) {
      const statement = database.prepare(sql);
      rows = statement.reader ? (statement.all() as Record<string, unknown>[]) : [];
      if (!statement.reader) statement.run();
    } else {
      database.exec(sql);
      rows = database.prepare("SELECT changes() AS rows_changed").all() as Record<string, unknown>[];
    }
    printRows(rows, options.json);
  }))
  .parseAsync();
