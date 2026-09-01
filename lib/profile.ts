import type { Database } from "better-sqlite3";

import { ddl } from "./core/db.ts";
import { columns, sections, takes } from "./core/ddl.ts";

export const fields = () =>
  sections(ddl()).flatMap((section) =>
    columns(ddl(), section).map((column) => `${section}.${column}`));

function split(field: string) {
  if (!fields().includes(field))
    throw new Error(`no such field '${field}' — job-profile missing lists every one that blocks`);
  const [section, column] = field.split(".");
  return { section, column };
}

export function set(database: Database, field: string, value: string) {
  const { section, column } = split(field);
  try {
    database.prepare(`UPDATE ${section} SET ${column}=? WHERE id=1`).run(value.trim());
  } catch {
    throw new Error(
      `'${value}' is not an answer to ${field} — it takes ${takes(ddl(), section, column)}`);
  }
}

export function clear(database: Database, field: string) {
  const { section, column } = split(field);
  database.prepare(`UPDATE ${section} SET ${column}=NULL WHERE id=1`).run();
}

export const answers = (database: Database) =>
  database
    .prepare("SELECT section, field, value FROM answers WHERE value IS NOT NULL")
    .all() as Record<string, unknown>[];

export const missing = (database: Database) =>
  database.prepare("SELECT field, section FROM unanswered").all() as Record<string, unknown>[];
