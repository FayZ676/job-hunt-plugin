import type { Database } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { SUBMITTED, absolute } from "./core/db.ts";

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

export type Waiting = {
  company: string; title: string; score: number | null;
  status: string; blocked_on: string | null; key: string;
};

export const review = (database: Database) =>
  database
    .prepare(
      "SELECT p.company, p.title, p.score, s.status, s.blocked_on, s.key " +
        "FROM staged s JOIN prospects p ON p.key=s.key " +
        "WHERE p.status='staged' ORDER BY s.status, p.score DESC")
    .all() as Waiting[];

type Recordable = {
  key: string; company: string; title: string; resume: string | null;
  status: string; staged_status: string | null; blocked_on: string | null;
};

export function record(database: Database, key: string, confirmation: string) {
  const said = confirmation.trim();
  if (!said)
    throw new Error("--confirmation cannot be empty: `applied` requires a confirmation page you saw");

  const row = database
    .prepare(
      "SELECT p.key, p.company, p.title, p.resume, p.status, s.status AS staged_status," +
        "       s.blocked_on FROM prospects p LEFT JOIN staged s ON s.key=p.key WHERE p.key=?")
    .get(key) as Recordable | undefined;
  if (!row) throw new Error(`no prospect '${key}'`);
  if (row.status === "applied") throw new Error(`${key} is already applied`);
  if (row.staged_status === null || row.staged_status === undefined)
    throw new Error(`${key} was never staged — run job-stage add first`);
  if (row.staged_status !== "ready")
    throw new Error(`${key} is ${row.staged_status}: ${row.blocked_on || "no reason recorded"}`);
  if (!row.resume) throw new Error(`${key} has no resume recorded`);

  const source = absolute(row.resume);
  if (!fs.existsSync(source))
    throw new Error(`the resume recorded for ${key} is not on disk: ${source}`);

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
      database
        .prepare("UPDATE postings SET status='applied', resume=? WHERE key=?")
        .run(resume, key);
      database
        .prepare("INSERT INTO events(key,status,note) VALUES(?,'applied',?)")
        .run(key, said);
    })();
  } catch (error) {
    for (const [original, target] of [...moved].reverse())
      if (fs.existsSync(target)) move(target, original);
    throw error;
  }

  return { resume, confirmation: said };
}

export function rejected(database: Database, key: string, note: string) {
  const said = note.trim();
  const row = database
    .prepare("SELECT key, resume, status FROM prospects WHERE key=?")
    .get(key) as { resume: string | null } | undefined;
  if (!row) throw new Error(`no prospect '${key}'`);
  if (!said)
    throw new Error("--note cannot be empty: record the shape — days elapsed, and any interview stage");

  database.transaction(() => {
    database.prepare("UPDATE postings SET status='rejected', resume=NULL WHERE key=?").run(key);
    database.prepare("INSERT INTO events(key,status,note) VALUES(?,'rejected',?)").run(key, said);
  })();

  const deleted: string[] = [];
  const stubborn: string[] = [];
  if (row.resume)
    for (const held of companions(absolute(row.resume))) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          fs.unlinkSync(held);
        } catch {
          /* already gone, or coming back */
        }
        if (!fs.existsSync(held)) break;
      }
      if (fs.existsSync(held)) stubborn.push(held);
      else deleted.push(held);
    }
  return { deleted, stubborn };
}
