import type { Database } from "better-sqlite3";
import fs from "node:fs";

import { absolute, ddl } from "./core/db.ts";
import { vocabulary } from "./core/ddl.ts";

const CLOSED = ["applied", "rejected", "closed"];

export const TIERS = () => [...vocabulary(ddl(), "staged_fields", "tier")].sort();

export type Field = { label: string; value: string; tier: string; flag: string | null };

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

export type Application = {
  key: string;
  company: string;
  title: string;
  url: string | null;
  status: string;
  blocked_on: string | null;
  screenshot: string | null;
  resume: string | null;
};

export function add(database: Database, key: string, filling: Filling): Staged {
  const row = database
    .prepare("SELECT key, company, title, status, resume FROM prospects WHERE key=?")
    .get(key) as { status: string; resume: string | null } | undefined;
  if (!row) throw new Error(`no prospect '${key}'`);
  if (CLOSED.includes(row.status))
    throw new Error(`${key} is already ${row.status} — nothing to stage`);
  if (!row.resume)
    throw new Error(`${key} has no resume — build it first: job-resume build <spec> --key ${key}`);
  if (!fs.existsSync(absolute(row.resume)))
    throw new Error(`the resume recorded for ${key} is not on disk: ${row.resume}`);

  const screenshot = absolute(filling.screenshot);
  if (!fs.existsSync(screenshot))
    throw new Error(`no screenshot at ${screenshot} — Phase 4 ends with the filled form captured`);

  if (!filling.fields.length)
    throw new Error(
      "stage at least one --field: an application with no recorded answers is not staged");

  const tiers = TIERS();
  for (const field of filling.fields) {
    if (!field.label) throw new Error("a field needs a label");
    if (!tiers.includes(field.tier))
      throw new Error(`tier must be one of ${tiers.join(", ")}, got '${field.tier}' on '${field.label}'`);
  }

  const empty = filling.fields.filter((field) => !field.value).map((field) => field.label);
  const blockedOn =
    filling.blockedOn || (empty.length ? `no answer for: ${empty.join("; ")}` : null);
  const status = blockedOn ? "blocked" : "ready";

  database.transaction(() => {
    database
      .prepare(
        "INSERT INTO staged(key,url,screenshot,status,blocked_on) VALUES(?,?,?,?,?) " +
          "ON CONFLICT(key) DO UPDATE SET url=excluded.url," +
          "  screenshot=excluded.screenshot, status=excluded.status, blocked_on=excluded.blocked_on")
      .run(key, filling.url, screenshot, status, blockedOn);
    database.prepare("DELETE FROM staged_fields WHERE key=?").run(key);
    const insert = database.prepare(
      "INSERT INTO staged_fields(key,label,value,tier,flag) VALUES(?,?,?,?,?)");
    for (const field of filling.fields)
      insert.run(key, field.label, field.value || null, field.tier, field.flag);
    database.prepare("UPDATE postings SET status='staged' WHERE key=?").run(key);
  })();

  return {
    status,
    blockedOn,
    fields: filling.fields.length,
    flagged: filling.fields.filter((field) => field.flag).map((field) => field.label),
  };
}

export function show(database: Database, key: string) {
  const application = database
    .prepare(
      "SELECT s.key, p.company, p.title, s.url, s.status, s.blocked_on, s.screenshot," +
        "       p.resume FROM staged s JOIN prospects p ON p.key=s.key WHERE s.key=?")
    .get(key) as Application | undefined;
  if (!application) throw new Error(`nothing staged for '${key}'`);
  return {
    application,
    fields: database
      .prepare("SELECT tier, label, value, flag FROM staged_fields WHERE key=? ORDER BY rowid")
      .all(key) as Record<string, unknown>[],
  };
}

export const list = (database: Database) =>
  database
    .prepare(
      "SELECT s.key, p.company, p.title, p.score, s.status, p.status AS prospect, " +
        "       s.blocked_on FROM staged s JOIN prospects p ON p.key=s.key " +
        "ORDER BY s.status, p.score DESC")
    .all() as Record<string, unknown>[];

export function drop(database: Database, key: string) {
  if (!database.prepare("SELECT 1 FROM staged WHERE key=?").get(key))
    throw new Error(`nothing staged for '${key}'`);
  database.transaction(() => {
    database.prepare("DELETE FROM staged_fields WHERE key=?").run(key);
    database.prepare("DELETE FROM staged WHERE key=?").run(key);
    database
      .prepare("UPDATE postings SET status='shortlisted' WHERE key=? AND status='staged'")
      .run(key);
  })();
}
