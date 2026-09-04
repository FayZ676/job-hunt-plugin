import Database from "better-sqlite3";
import type { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { tables } from "./ddl.ts";
import { ROOT } from "./root.ts";
import { align } from "./schema.ts";

export const absolute = (held: string) => path.resolve(held.replace(/^~(?=$|\/)/, os.homedir()));

export const companions = (pdf: string) => {
  const stem = pdf.slice(0, pdf.length - path.extname(pdf).length);
  return [pdf, `${stem}.json`, `${stem}.typ`].filter((held) => fs.existsSync(held));
};

export const CAREER = absolute(process.env.JOB_CAREER_DIR || "~/data/job");
export const DB = path.join(CAREER, "job.db");
export const RESUMES = path.join(CAREER, "resumes");
export const SUBMITTED = path.join(RESUMES, "submitted");

export const PATHS = {
  career: CAREER,
  db: DB,
  resumes: RESUMES,
  submitted: SUBMITTED,
};

const held = globalThis as { db?: Database.Database; ddl?: string };

export const ddl = () => (held.ddl ??= `${tables()}\n${fs.readFileSync(path.join(ROOT, "sql", "logic.sql"), "utf8")}`);

export function connect(at: string = DB) {
  fs.mkdirSync(path.dirname(at) || ".", { recursive: true });
  const opened = new Database(at);
  opened.pragma("foreign_keys = ON");
  opened.exec(ddl());
  align(opened);
  return opened;
}

export function db() {
  return (held.db ??= connect());
}

export function open(at?: string | null) {
  if (!at) return db();
  return (held.db = connect(absolute(at)));
}

const parsed = <T extends z.ZodType>(shape: T, sql: string, row: unknown): z.infer<T> => {
  const read = shape.safeParse(row);
  if (read.success) return read.data;
  throw new Error(
    `${sql}\nreturned a row its shape does not describe:\n` +
      read.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n"),
  );
};

export const rows = <T extends z.ZodType>(shape: T, sql: string, args: unknown[] = []): z.infer<T>[] =>
  (
    db()
      .prepare(sql)
      .all(...args) as unknown[]
  ).map((row) => parsed(shape, sql, row));

export const one = <T extends z.ZodType>(shape: T, sql: string, args: unknown[] = []): z.infer<T> | null => {
  const found = db()
    .prepare(sql)
    .get(...args);
  return found === undefined || found === null ? null : parsed(shape, sql, found);
};
