import { db, rows } from "./core/db.ts";
import { SECTIONS, VIEWS, columns, takes, type Table } from "./core/schema.ts";

export const fields = () =>
  SECTIONS.flatMap((section) =>
    columns(section).map((column) => `${section}.${column}`),
  );

function split(field: string) {
  if (!fields().includes(field))
    throw new Error(
      `no such field '${field}' — job-profile missing lists every one that blocks`,
    );
  const [section, column] = field.split(".");
  return { section: section as Table, column };
}

export function set(field: string, value: string) {
  const { section, column } = split(field);
  try {
    db()
      .prepare(`UPDATE ${section} SET ${column}=? WHERE id=1`)
      .run(value.trim());
  } catch {
    throw new Error(
      `'${value}' is not an answer to ${field} — it takes ${takes(section, column)}`,
    );
  }
}

export function clear(field: string) {
  const { section, column } = split(field);
  db().prepare(`UPDATE ${section} SET ${column}=NULL WHERE id=1`).run();
}

export const answers = () =>
  rows(
    VIEWS.answers,
    "SELECT section, field, value FROM answers WHERE value IS NOT NULL",
  );

export const missing = () =>
  rows(VIEWS.unanswered, "SELECT section, field FROM unanswered");
