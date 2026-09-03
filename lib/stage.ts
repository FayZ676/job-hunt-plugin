import fs from "node:fs";
import { z } from "zod";

import { absolute, db, one, rows } from "./core/db.ts";
import { TABLES, VIEWS, options } from "./core/schema.ts";

const CLOSED = ["applied", "rejected", "closed"];

export const TIERS = () => [...options("staged_fields", "tier")].sort();

const Ready = VIEWS.prospects.pick({
  key: true,
  company: true,
  title: true,
  status: true,
  resume: true,
});

const Answer = TABLES.staged_fields.pick({
  tier: true,
  label: true,
  value: true,
  flag: true,
});

const Application = TABLES.staged
  .pick({
    key: true,
    url: true,
    status: true,
    blocked_on: true,
    screenshot: true,
  })
  .extend(VIEWS.prospects.pick({ company: true, title: true, resume: true }).shape);

const Waiting = TABLES.staged
  .pick({ key: true, status: true, blocked_on: true })
  .extend(VIEWS.prospects.pick({ company: true, title: true, score: true }).shape)
  .extend({ prospect: VIEWS.prospects.shape.status });

export type Field = {
  label: string;
  value: string;
  tier: string;
  flag: string | null;
};
export type Application = z.infer<typeof Application>;

export type Filling = {
  url: string;
  screenshot: string;
  fields: Field[];
  blockedOn?: string | null;
};

export type Staged = {
  status: "ready" | "blocked";
  blockedOn: string | null;
  fields: number;
  flagged: string[];
};

export function add(key: string, filling: Filling): Staged {
  const row = one(Ready, "SELECT key, company, title, status, resume FROM prospects WHERE key=?", [key]);
  if (!row) throw new Error(`no prospect '${key}'`);
  if (row.status && CLOSED.includes(row.status)) throw new Error(`${key} is already ${row.status} — nothing to stage`);
  if (!row.resume) throw new Error(`${key} has no resume — build it first: job-resume build <spec> --key ${key}`);
  if (!fs.existsSync(absolute(row.resume)))
    throw new Error(`the resume recorded for ${key} is not on disk: ${row.resume}`);

  const screenshot = absolute(filling.screenshot);
  if (!fs.existsSync(screenshot))
    throw new Error(`no screenshot at ${screenshot} — staging ends with the filled form captured`);

  if (!filling.fields.length)
    throw new Error("stage at least one --field: an application with no recorded answers is not staged");

  const tiers = TIERS();
  for (const field of filling.fields) {
    if (!field.label) throw new Error("a field needs a label");
    if (!tiers.includes(field.tier))
      throw new Error(`tier must be one of ${tiers.join(", ")}, got '${field.tier}' on '${field.label}'`);
  }

  const empty = filling.fields.filter((field) => !field.value).map((field) => field.label);
  const blockedOn = filling.blockedOn || (empty.length ? `no answer for: ${empty.join("; ")}` : null);
  const status = blockedOn ? "blocked" : "ready";

  db().transaction(() => {
    db()
      .prepare(
        "INSERT INTO staged(key,url,screenshot,status,blocked_on) VALUES(?,?,?,?,?) " +
          "ON CONFLICT(key) DO UPDATE SET url=excluded.url," +
          "  screenshot=excluded.screenshot, status=excluded.status, blocked_on=excluded.blocked_on",
      )
      .run(key, filling.url, screenshot, status, blockedOn);
    db().prepare("DELETE FROM staged_fields WHERE key=?").run(key);
    const insert = db().prepare("INSERT INTO staged_fields(key,label,value,tier,flag) VALUES(?,?,?,?,?)");
    for (const field of filling.fields) insert.run(key, field.label, field.value || null, field.tier, field.flag);
    db().prepare("UPDATE postings SET status='staged' WHERE key=?").run(key);
  })();

  return {
    status,
    blockedOn,
    fields: filling.fields.length,
    flagged: filling.fields.filter((field) => field.flag).map((field) => field.label),
  };
}

export function show(key: string) {
  const application = one(
    Application,
    "SELECT s.key, p.company, p.title, s.url, s.status, s.blocked_on, s.screenshot," +
      "       p.resume FROM staged s JOIN prospects p ON p.key=s.key WHERE s.key=?",
    [key],
  );
  if (!application) throw new Error(`nothing staged for '${key}'`);
  return {
    application,
    fields: rows(Answer, "SELECT tier, label, value, flag FROM staged_fields WHERE key=? ORDER BY rowid", [key]),
  };
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
    db().prepare("DELETE FROM staged_fields WHERE key=?").run(key);
    db().prepare("DELETE FROM staged WHERE key=?").run(key);
    db().prepare("UPDATE postings SET status='shortlisted' WHERE key=? AND status='staged'").run(key);
  })();
}
