"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "./db";
import { TABLES, type Table } from "./schema";

const WRITABLE = new Set<Table>([
  "profile", "education", "employers", "projects", "project_bullets",
  "project_technologies", "project_metrics", "project_links",
  "search_criteria", "search_notes", "facts", "company_limits", "accounts",
]);

export type Saved = { rowid: number } | { error: string };

const failed = (error: unknown) => ({ error: String((error as Error).message).replace(/\s+/g, " ") });

function writable(table: string) {
  if (!WRITABLE.has(table as Table)) throw new Error(`${table} is not editable from the dashboard`);
  const generated = new Set(
    (db().pragma(`table_xinfo(${table})`) as { name: string; hidden: number }[])
      .filter((column) => column.hidden).map((column) => column.name));

  return z.object(Object.fromEntries(
    Object.entries(TABLES[table as Table].shape)
      .filter(([name]) => !generated.has(name))
      .map(([name, column]) => [name, z.preprocess((value) => {
        if (value === "" || value == null) return null;
        return column.safeParse(0).success ? Number(value) : value;
      }, column)]),
  )).partial();
}

export async function save(
  table: string,
  rowid: number | null,
  values: Record<string, string>,
): Promise<Saved> {
  try {
    const parsed = writable(table).safeParse(values);
    if (!parsed.success) return { error: z.prettifyError(parsed.error).replace(/\s+/g, " ") };

    const bound = parsed.data as Record<string, unknown>;
    const names = Object.keys(bound);
    if (!names.length)
      return { error: `no writable column among ${Object.keys(values).join(", ") || "(none)"}` };

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
