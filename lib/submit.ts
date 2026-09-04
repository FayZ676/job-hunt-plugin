import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { requires } from "./core/actions.ts";
import { SUBMITTED, absolute, companions, db, one, rows } from "./core/db.ts";
import { TABLES, VIEWS } from "./core/schema.ts";

const move = (from: string, to: string) => {
  try {
    fs.renameSync(from, to);
  } catch {
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
};

const Waiting = VIEWS.prospects
  .pick({ company: true, title: true, score: true })
  .extend(TABLES.staged.pick({ status: true, blocked_on: true, key: true }).shape);

const Recordable = VIEWS.prospects.pick({ key: true, company: true, title: true, resume: true, status: true }).extend({
  staged_status: TABLES.staged.shape.status,
  blocked_on: TABLES.staged.shape.blocked_on,
});

export type Waiting = z.infer<typeof Waiting>;

export const review = () =>
  rows(
    Waiting,
    "SELECT p.company, p.title, p.score, s.status, s.blocked_on, s.key " +
      "FROM staged s JOIN prospects p ON p.key=s.key " +
      "WHERE p.status='staged' ORDER BY s.status, p.score DESC",
  );

export function record(key: string, confirmation: string) {
  const said = confirmation.trim();
  if (!said) throw new Error("--confirmation cannot be empty: `applied` requires a confirmation page you saw");

  const row = one(
    Recordable,
    "SELECT p.key, p.company, p.title, p.resume, p.status, s.status AS staged_status," +
      "       s.blocked_on FROM prospects p LEFT JOIN staged s ON s.key=p.key WHERE p.key=?",
    [key],
  );
  if (!row) throw new Error(`no prospect '${key}'`);
  requires("submit", key, row.status);
  if (row.staged_status === null || row.staged_status === undefined)
    throw new Error(`${key} was never staged — run job-stage add first`);
  if (row.staged_status !== "ready")
    throw new Error(`${key} is ${row.staged_status}: ${row.blocked_on || "no reason recorded"}`);
  if (!row.resume) throw new Error(`${key} has no resume recorded`);

  const source = absolute(row.resume);
  if (!fs.existsSync(source)) throw new Error(`the resume recorded for ${key} is not on disk: ${source}`);

  fs.mkdirSync(SUBMITTED, { recursive: true });
  const moved: [string, string][] = [];
  const resume = path.join(SUBMITTED, path.basename(source));
  try {
    for (const held of companions(source)) {
      const target = path.join(SUBMITTED, path.basename(held));
      move(held, target);
      moved.push([held, target]);
    }
    db().transaction(() => {
      db().prepare("UPDATE postings SET status='applied', resume=? WHERE key=?").run(resume, key);
      db().prepare("INSERT INTO events(key,status,note) VALUES(?,'applied',?)").run(key, said);
    })();
  } catch (error) {
    for (const [original, target] of [...moved].reverse()) if (fs.existsSync(target)) move(target, original);
    throw error;
  }

  return { resume, confirmation: said };
}

export function rejected(key: string, note: string) {
  const said = note.trim();
  const row = one(
    VIEWS.prospects.pick({ key: true, resume: true, status: true }),
    "SELECT key, resume, status FROM prospects WHERE key=?",
    [key],
  );
  if (!row) throw new Error(`no prospect '${key}'`);
  if (!said) throw new Error("--note cannot be empty: record the shape — days elapsed, and any interview stage");

  db().transaction(() => {
    db().prepare("UPDATE postings SET status='rejected', resume=NULL WHERE key=?").run(key);
    db().prepare("INSERT INTO events(key,status,note) VALUES(?,'rejected',?)").run(key, said);
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
