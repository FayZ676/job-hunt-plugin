#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

import { SUBMITTED, open } from "../lib/db.ts";
import { printRows } from "../lib/table.ts";
import { fail, guard } from "./kit.ts";

const absolute = (held: string) => path.resolve(held.replace(/^~(?=$|\/)/, os.homedir()));

const companions = (pdf: string) => {
  const stem = pdf.slice(0, pdf.length - path.extname(pdf).length);
  return [pdf, `${stem}.json`, `${stem}.typ`].filter((held) => fs.existsSync(held));
};

const move = (from: string, to: string) => {
  try {
    fs.renameSync(from, to);
  } catch {
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
};

const program = new Command("job-submit").description(
  `Phase 5 — present what is staged, submit only what the user names, record it.

  job-submit review                      the approval table: one row per staged application
  job-submit record KEY --confirmation "Application received — #A12"
  job-submit rejected KEY --note "3 days, no interview — resume screen"

Recording an application moves its resume into submitted/ in the same step that
sets \`applied\`; a rejection deletes that file, and checks it did not come back.`);

program
  .command("review")
  .description("the approval table the user reads before naming any")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    const rows = open(options.db).prepare(
      "SELECT p.company, p.title, p.score, s.status, s.blocked_on, s.key " +
      "FROM staged s JOIN prospects p ON p.key=s.key " +
      "WHERE p.status='staged' ORDER BY s.status, p.score DESC")
      .all() as { status: string }[];
    printRows(rows as Record<string, unknown>[], options.json);
    if (rows.length && !options.json) {
      const ready = rows.filter((row) => row.status === "ready").length;
      console.log(`\n${ready} ready. Nothing goes out until the user names it, in this run.`);
    }
  }));

program
  .command("record")
  .description("mark applied and move the resume into submitted/")
  .argument("<key>")
  .requiredOption("--confirmation <text>",
    "what the confirmation page said — clicking the button is not evidence")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const confirmation = options.confirmation.trim();
    if (!confirmation)
      fail("--confirmation cannot be empty: `applied` requires a confirmation page you saw");

    const database = open(options.db);
    const row = database.prepare(
      "SELECT p.key, p.company, p.title, p.resume, p.status, s.status AS staged_status," +
      "       s.blocked_on FROM prospects p LEFT JOIN staged s ON s.key=p.key WHERE p.key=?")
      .get(key) as any;
    if (!row) fail(`no prospect '${key}'`);
    if (row.status === "applied") fail(`${key} is already applied`);
    if (row.staged_status === null || row.staged_status === undefined)
      fail(`${key} was never staged — run job-stage add first`);
    if (row.staged_status !== "ready")
      fail(`${key} is ${row.staged_status}: ${row.blocked_on || "no reason recorded"}`);
    if (!row.resume) fail(`${key} has no resume recorded`);

    const source = absolute(row.resume);
    if (!fs.existsSync(source))
      fail(`the resume recorded for ${key} is not on disk: ${source}`);

    fs.mkdirSync(SUBMITTED, { recursive: true });
    const moved: [string, string][] = [];
    const resume = path.join(SUBMITTED, path.basename(source));
    try {
      for (const held of companions(source)) {
        const target = path.join(SUBMITTED, path.basename(held));
        move(held, target);
        moved.push([held, target]);
      }
      database.transaction(() => {
        database.prepare("UPDATE postings SET status='applied', resume=? WHERE key=?")
          .run(resume, key);
        database.prepare("INSERT INTO events(key,status,note) VALUES(?,'applied',?)")
          .run(key, confirmation);
      })();
    } catch (error) {
      for (const [original, target] of [...moved].reverse())
        if (fs.existsSync(target)) move(target, original);
      throw error;
    }

    console.log(`${key}  applied`);
    console.log(`  resume  ${resume}`);
    console.log(`  saw     ${confirmation}`);
  }));

program
  .command("rejected")
  .description("record a reported rejection and delete its resume")
  .argument("<key>")
  .requiredOption("--note <text>")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const database = open(options.db);
    const row = database.prepare("SELECT key, resume, status FROM prospects WHERE key=?")
      .get(key) as { resume: string | null } | undefined;
    if (!row) fail(`no prospect '${key}'`);
    const note = options.note.trim();
    if (!note)
      fail("--note cannot be empty: record the shape — days elapsed, and any interview stage");

    database.transaction(() => {
      database.prepare("UPDATE postings SET status='rejected', resume=NULL WHERE key=?").run(key);
      database.prepare("INSERT INTO events(key,status,note) VALUES(?,'rejected',?)").run(key, note);
    })();
    console.log(`${key}  rejected`);

    if (!row.resume) return;
    const stubborn: string[] = [];
    for (const held of companions(absolute(row.resume))) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          fs.unlinkSync(held);
        } catch { /* already gone, or coming back */ }
        if (!fs.existsSync(held)) break;
      }
      if (fs.existsSync(held)) stubborn.push(held);
      else console.log(`  deleted ${held}`);
    }
    if (stubborn.length) {
      console.log("\na synced folder keeps re-materializing these — delete them by hand:");
      for (const held of stubborn) console.log(`  ${held}`);
      process.exit(1);
    }
  }));

program.parseAsync();
