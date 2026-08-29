"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { db } from "./db.ts";
import { TABLES, type Table } from "./schema.ts";

const WRITABLE = new Set<Table>([
  "identity",
  "education", "employers", "projects", "project_bullets",
  "project_technologies", "project_metrics", "project_links",
  "search_criteria", "accounts",
]);

export type Saved = { rowid: number } | { error: string };

const failed = (error: unknown) => ({
  error: error instanceof z.ZodError
    ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
    : String((error as Error).message).replace(/\s+/g, " "),
});

type Held = { name: string; type: string; hidden: number };

function writable(table: string) {
  if (!WRITABLE.has(table as Table)) throw new Error(`${table} is not editable from the dashboard`);
  return (db().pragma(`table_xinfo(${table})`) as Held[]).filter((column) => !column.hidden);
}

const bind = (column: Held, raw: string) =>
  raw === "" || raw === null || raw === undefined ? null
    : column.type === "INTEGER" || column.type === "REAL" ? Number(raw)
    : raw;

const marshalled = (table: string, values: Record<string, string>) =>
  Object.fromEntries(writable(table)
    .filter((column) => column.name in values)
    .map((column) => [column.name, bind(column, values[column.name])]));

export async function save(
  table: string,
  rowid: number | null,
  values: Record<string, string>,
): Promise<Saved> {
  try {
    const bound = marshalled(table, values);
    const names = Object.keys(bound);
    if (!names.length)
      return { error: `no writable column among ${Object.keys(values).join(", ") || "(none)"}` };

    TABLES[table as Table].partial().parse(bound);

    if (rowid === null) {
      rowid = Number(db().prepare(
        `INSERT INTO ${table}(${names}) VALUES(${names.map((name) => ":" + name)})`,
      ).run(bound).lastInsertRowid);
    } else if (!db().prepare(
      `UPDATE ${table} SET ${names.map((name) => `${name}=:${name}`)} WHERE rowid=:rowid`,
    ).run({ ...bound, rowid }).changes) {
      return { error: `no row ${rowid} in ${table}` };
    }
    revalidatePath("/", "layout");
    return { rowid };
  } catch (error) {
    return failed(error);
  }
}

export async function remove(table: string, rowid: number): Promise<Saved> {
  try {
    writable(table);
    if (!db().prepare(`DELETE FROM ${table} WHERE rowid=?`).run(rowid).changes)
      return { error: `no row ${rowid} in ${table}` };
    revalidatePath("/", "layout");
    return { rowid };
  } catch (error) {
    return failed(error);
  }
}
