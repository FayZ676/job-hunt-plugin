#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { Command } from "commander";

import { open } from "../lib/core/db.ts";
import { printRows } from "../lib/core/table.ts";
import { fail, guard } from "./kit.ts";

const program = new Command("job-score").description(
  `Phase 2 — score every prospect against the search profile.

  job-score triage                        the cheap list: no descriptions, on purpose
  job-score triage --status new
  job-score rubric                        the search profile, what scoring reads
  job-score show KEY [KEY ...]            full text, for survivors only
  job-score set KEY --score 9 --reason "the JD language that drove it, quoted"
  job-score pending                       what is still unscored and will come back tomorrow

A score sets the status by the threshold in settings, so the two cannot disagree.`);

type Standing = {
  location: string | null;
  remote_preference: string | null;
  willing_to_relocate: number | null;
  employment_type: string | null;
  compensation_floor: number | null;
  compensation_currency: string | null;
  requires_sponsorship_now_or_future: number | null;
  legal_right_to_work_without_sponsorship: number | null;
};

const said = (value: string) => value.replace(/_/g, " ");

const standing = (row: Standing | undefined) => [
  row?.location && `Based in ${row.location}.`,
  row?.remote_preference && `Wants ${said(row.remote_preference)} work.`,
  row?.willing_to_relocate === 0 && "Will not relocate for a role.",
  row?.willing_to_relocate === 1 && "Open to relocating.",
  row?.employment_type && `Wants ${said(row.employment_type)} roles.`,
  row?.compensation_floor
    && `Will not go below ${row.compensation_floor} ${row.compensation_currency ?? ""}.`.trim(),
  row?.requires_sponsorship_now_or_future === 0
    && row?.legal_right_to_work_without_sponsorship === 1
    && "Needs no visa sponsorship, now or later.",
].filter((line): line is string => Boolean(line));

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
  .description("everything scoring reads: standing profile facts, the rubric, then titles")
  .option("--db <path>")
  .action(guard((options) => {
    const database = open(options.db);
    const held = standing(database
      .prepare("SELECT * FROM identity WHERE id=1")
      .get() as Standing | undefined);
    if (held.length) {
      console.log("From the profile, and not up for debate:");
      for (const line of held) console.log(`- ${line}`);
      console.log("");
    }
    const scope = database
      .prepare("SELECT worth_applying_to FROM search_scope WHERE id=1")
      .get() as { worth_applying_to: string | null };
    console.log(`${scope.worth_applying_to ?? "(nothing written down)"}\n`);
    const titles = database
      .prepare("SELECT value FROM search_titles ORDER BY seq IS NULL, seq, value")
      .all() as { value: string }[];
    console.log("Titles, strongest first:");
    for (const row of titles) console.log(`- ${row.value}`);
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
