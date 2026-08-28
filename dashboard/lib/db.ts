import Database from "better-sqlite3";
import type { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { align } from "./schema";

export const CAREER = path.resolve(
  (process.env.JOB_CAREER_DIR || "~/data/job").replace(/^~(?=$|\/)/, os.homedir()),
);
export const DB = path.join(CAREER, "job.db");
export const RESUMES = path.join(CAREER, "resumes");

const SQL = path.join(process.cwd(), "..", "sql");

const held = globalThis as { db?: Database.Database; ddl?: string };

export const ddl = () =>
  (held.ddl ??= ["job", "profile"]
    .map((part) => fs.readFileSync(path.join(SQL, `${part}.sql`), "utf8"))
    .join("\n"));

export function db() {
  if (!held.db) {
    fs.mkdirSync(CAREER, { recursive: true });
    const opened = new Database(DB);
    opened.pragma("foreign_keys = ON");
    const sql = ddl();
    opened.exec(sql);
    align(opened, sql);
    held.db = opened;
  }
  return held.db;
}

export const rows = <T extends z.ZodType>(shape: T, sql: string, args: unknown[] = []) =>
  db().prepare(sql).all(...args).map((row) => shape.parse(row) as z.infer<T>);

export const one = <T extends z.ZodType>(shape: T, sql: string, args: unknown[] = []) => {
  const found = db().prepare(sql).get(...args);
  return found ? (shape.parse(found) as z.infer<T>) : null;
};
