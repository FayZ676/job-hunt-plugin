#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { printRows } from "../lib/core/table.ts";
import { purge, reckon } from "../lib/cleanup.ts";
import { action } from "./kit.ts";

const { program, runs } = action(
  "job-cleanup",
  `Remove postings from the database, and the resumes built for them.

  job-cleanup --where "disposition='stale' AND last_fetched < date('now','-90 days')"
  job-cleanup --where "status='rejected'" --confirm
  job-cleanup --where "company='Acme'" --json

Prints what matches and deletes nothing until --confirm. A row taken with
--confirm is gone: its events, its staged answers and its resume files go with
it, and no later search brings back what it knew.`,
);

program
  .requiredOption("--where <sql>", "the condition, over postings, that says what to remove")
  .option("--confirm", "actually delete what the same --where just matched")
  .option("--json")
  .action(
    runs((options) => {
      const removed = options.confirm ? purge(options.where) : null;
      const done = removed ?? reckon(options.where);
      const rows = done.postings.map(({ resume, ...shown }) => shown);

      if (options.json) return console.log(JSON.stringify(done, null, 2));

      printRows(rows);
      if (!done.postings.length) return console.log("nothing matches; nothing removed");

      console.log(
        `\n${done.postings.length} postings` +
          (done.duplicates ? ` (${done.duplicates} pulled in as duplicates of one)` : "") +
          `, ${done.events} events, ${done.staged} staged, ${done.files.length} resume files`,
      );
      if (!removed) return console.log("nothing removed — run again with --confirm");

      console.log("removed");
      if (removed.stubborn.length) console.log(`still on disk, delete by hand:\n  ${removed.stubborn.join("\n  ")}`);
    }),
  );

program.parseAsync();
