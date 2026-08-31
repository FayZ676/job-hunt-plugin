import Database from "better-sqlite3";
import type { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ROOT } from "./root.ts";
import { align, prune } from "./schema.ts";

export const CAREER = path.resolve(
  (process.env.JOB_CAREER_DIR || "~/data/job").replace(/^~(?=$|\/)/, os.homedir()),
);
export const DB = path.join(CAREER, "job.db");
export const RESUMES = path.join(CAREER, "resumes");
export const SUBMITTED = path.join(RESUMES, "submitted");

export const PATHS = { career: CAREER, db: DB, resumes: RESUMES, submitted: SUBMITTED };

const SQL = path.join(ROOT, "sql");

const held = globalThis as { db?: Database.Database; ddl?: string };

export const ddl = () =>
  (held.ddl ??= ["job", "profile"]
    .map((part) => fs.readFileSync(path.join(SQL, `${part}.sql`), "utf8"))
    .join("\n"));

export function connect(at: string = DB) {
  fs.mkdirSync(path.dirname(at) || ".", { recursive: true });
  const opened = new Database(at);
  opened.pragma("foreign_keys = ON");
  const sql = ddl();
  opened.exec(sql);
  prune(opened, sql);
  align(opened, sql);
  return opened;
}

export function db() {
  return (held.db ??= connect());
}

export function open(at?: string | null) {
  if (!at) return db();
  return (held.db = connect(path.resolve(at.replace(/^~(?=$|\/)/, os.homedir()))));
}

export const rows = <T extends z.ZodType>(_shape: T, sql: string, args: unknown[] = []) =>
  db().prepare(sql).all(...args) as z.infer<T>[];

export const one = <T extends z.ZodType>(_shape: T, sql: string, args: unknown[] = []) =>
  (db().prepare(sql).get(...args) ?? null) as z.infer<T> | null;
