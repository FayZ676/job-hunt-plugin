import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CAREER = path.resolve(
  (process.env.JOB_CAREER_DIR || "~/data/job").replace(/^~(?=$|\/)/, os.homedir()),
);
export const DB = path.join(CAREER, "job.db");
export const RESUMES = path.join(CAREER, "resumes");

const SQL = path.join(process.cwd(), "..", "sql");
const schema = () =>
  ["job", "profile"]
    .map((part) => fs.readFileSync(path.join(SQL, `${part}.sql`), "utf8"))
    .join("\n");

const held = globalThis as { db?: Database.Database };

export function db() {
  if (!held.db) {
    fs.mkdirSync(CAREER, { recursive: true });
    held.db = new Database(DB);
    held.db.pragma("foreign_keys = ON");
    held.db.exec(schema());
  }
  return held.db;
}

export type Row = Record<string, string | number | null>;

export const rows = <T = Row>(sql: string, args: unknown[] = []) =>
  db().prepare(sql).all(...args) as T[];

export const one = <T = Row>(sql: string, args: unknown[] = []) =>
  (db().prepare(sql).get(...args) as T | undefined) ?? null;

export function vocabulary(table: string, column: string): string[] {
  const body = schema().match(
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`),
  );
  const listed = body?.[1].match(new RegExp(`${column}\\s+TEXT[\\s\\S]*?IN \\(([\\s\\S]*?)\\)\\)`));
  return listed ? [...listed[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
}
