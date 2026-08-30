#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { Command } from "commander";

import { open } from "../lib/db.ts";
import { printRows } from "../lib/table.ts";
import { fail, guard } from "./kit.ts";

const program = new Command("job-score").description(
  `Phase 2 — score every prospect against the search profile.

  job-score triage                        the cheap list: no descriptions, on purpose
  job-score triage --status new
  job-score rubric                        search_criteria, what scoring reads
  job-score show KEY [KEY ...]            full text, for survivors only
  job-score set KEY --score 9 --reason "the JD language that drove it, quoted"
  job-score pending                       what is still unscored and will come back tomorrow

A score sets the status by the threshold in settings, so the two cannot disagree.`);

program
  .command("triage")
  .description("the triage view: no descriptions, on purpose")
  .option("--status <status>")
  .option("--limit <n>", "", Number)
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    let sql = "SELECT * FROM triage" + (options.status ? " WHERE status=?" : "");
    if (options.limit) sql += ` LIMIT ${Number(options.limit)}`;
    const rows = open(options.db)
      .prepare(sql)
      .all(...(options.status ? [options.status] : [])) as Record<string, unknown>[];
    printRows(rows, options.json);
  }));

program
  .command("rubric")
  .description("the criteria scoring reads, strongest first within each kind")
  .option("--db <path>")
  .action(guard((options) => {
    const database = open(options.db);
    const criteria = database
      .prepare("SELECT kind, value FROM search_criteria ORDER BY kind, seq IS NULL, seq, value")
      .all() as { kind: string; value: string }[];
    for (const row of criteria) console.log(`${row.kind.padEnd(18)}  ${row.value}`);
  }));

program
  .command("show")
  .description("full description for the prospects that survived triage")
  .argument("<key...>")
  .option("--db <path>")
  .action(guard((keys: string[], options) => {
    const database = open(options.db);
    for (const key of keys) {
      const row = database.prepare(
        "SELECT key, company, title, location, remote, compensation, posted_at, url, " +
        "score, status, description FROM prospects WHERE key=?").get(key) as any;
      if (!row) {
        console.error(`no prospect '${key}'`);
        continue;
      }
      console.log(`${row.company} — ${row.title}  [${row.key}]`);
      console.log(`  ${row.location || "(no location)"}` +
        `${row.remote ? "  remote" : ""}` +
        `${row.compensation ? "  " + row.compensation : ""}`);
      console.log(`  posted ${row.posted_at || "unknown"}   ${row.status}` +
        `${row.score !== null ? "  score " + row.score : ""}`);
      console.log(`  ${row.url || ""}\n`);
      console.log(row.description || "(no description — job-score set will refuse this one)");
      console.log("\n" + "-".repeat(78) + "\n");
    }
  }));

program
  .command("set")
  .description("record a score and the reason that drove it")
  .argument("<key>")
  .requiredOption("--score <n>", "", Number)
  .requiredOption("--reason <text>")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const database = open(options.db);
    const row = database
      .prepare("SELECT key, description, status FROM prospects WHERE key=?")
      .get(key) as { description: string | null } | undefined;
    if (!row) fail(`no prospect '${key}'`);
    const score = Number(options.score);
    if (!(score >= 0 && score <= 10)) fail(`score must be 0-10, got ${options.score}`);
    if (!options.reason.trim())
      fail("--reason cannot be empty: name the JD language that drove the score");
    if (!(row.description ?? "").trim())
      fail(`${key} has no description — scoring off a title is what this phase exists to ` +
        "prevent. Re-fetch the source: every source now carries its description");

    database.prepare("UPDATE postings SET score=?, reason=? WHERE key=?")
      .run(score, options.reason.trim(), key);
    const after = database
      .prepare("SELECT score, status FROM prospects WHERE key=?")
      .get(key) as { score: number; status: string };
    console.log(`${key}  ${after.score}  ${after.status}`);
  }));

program
  .command("pending")
  .description("prospects with no score yet")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    const rows = open(options.db).prepare(
      "SELECT key, company, title, location, first_seen FROM prospects " +
      "WHERE score IS NULL ORDER BY first_seen DESC").all() as Record<string, unknown>[];
    printRows(rows, options.json);
    if (rows.length && !options.json)
      console.log(`\n${rows.length} unscored — each one stays \`new\` and comes back tomorrow`);
  }));

program.parseAsync();
