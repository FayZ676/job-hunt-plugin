import fs from "node:fs";
import { z } from "zod";

import { requires } from "./core/actions.ts";
import { absolute, db, one, rows } from "./core/db.ts";
import { TABLES, VIEWS } from "./core/schema.ts";

const Ready = VIEWS.prospects.pick({
  key: true,
  company: true,
  title: true,
  status: true,
  resume: true,
});

const Application = TABLES.staged
  .pick({
    key: true,
    url: true,
    status: true,
    blocked_on: true,
  })
  .extend(VIEWS.prospects.pick({ company: true, title: true, resume: true }).shape);

const Waiting = TABLES.staged
  .pick({ key: true, status: true, blocked_on: true })
  .extend(VIEWS.prospects.pick({ company: true, title: true, score: true }).shape)
  .extend({ prospect: VIEWS.prospects.shape.status });

export type Application = z.infer<typeof Application>;

export type Filling = {
  url: string;
  blockedOn?: string | null;
};

export type Staged = {
  status: "ready" | "blocked";
  blockedOn: string | null;
};

export function add(key: string, filling: Filling): Staged {
  const row = one(Ready, "SELECT key, company, title, status, resume FROM prospects WHERE key=?", [key]);
  if (!row) throw new Error(`no prospect '${key}'`);
  requires("apply", key, row.status);
  if (!row.resume) throw new Error(`${key} has no resume — build it first: job-resume build <spec> --key ${key}`);
  if (!fs.existsSync(absolute(row.resume)))
    throw new Error(`the resume recorded for ${key} is not on disk: ${row.resume}`);

  const blockedOn = filling.blockedOn?.trim() || null;
  const status = blockedOn ? "blocked" : "ready";

  db().transaction(() => {
    db()
      .prepare(
        "INSERT INTO staged(key,url,status,blocked_on) VALUES(?,?,?,?) " +
          "ON CONFLICT(key) DO UPDATE SET url=excluded.url," +
          "  status=excluded.status, blocked_on=excluded.blocked_on",
      )
      .run(key, filling.url, status, blockedOn);
    db().prepare("UPDATE postings SET status='staged' WHERE key=?").run(key);
  })();

  return { status, blockedOn };
}

export function show(key: string) {
  const application = one(
    Application,
    "SELECT s.key, p.company, p.title, s.url, s.status, s.blocked_on," +
      "       p.resume FROM staged s JOIN prospects p ON p.key=s.key WHERE s.key=?",
    [key],
  );
  if (!application) throw new Error(`nothing staged for '${key}'`);
  return application;
}

export const list = () =>
  rows(
    Waiting,
    "SELECT s.key, p.company, p.title, p.score, s.status, p.status AS prospect, " +
      "       s.blocked_on FROM staged s JOIN prospects p ON p.key=s.key " +
      "ORDER BY s.status, p.score DESC",
  );

export function drop(key: string) {
  if (!one(TABLES.staged.pick({ key: true }), "SELECT key FROM staged WHERE key=?", [key]))
    throw new Error(`nothing staged for '${key}'`);
  db().transaction(() => {
    db().prepare("DELETE FROM staged WHERE key=?").run(key);
    db().prepare("UPDATE postings SET status='shortlisted' WHERE key=? AND status='staged'").run(key);
  })();
}
