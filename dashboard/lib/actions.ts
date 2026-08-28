"use server";

import { revalidatePath } from "next/cache";
import { db } from "./db";

const WRITABLE = new Set([
  "profile", "education", "employers", "projects", "project_bullets",
  "project_technologies", "project_metrics", "project_links",
  "search_criteria", "search_notes", "facts", "company_limits", "accounts",
]);

export type Saved = { rowid: number } | { error: string };

function columns(table: string) {
  if (!WRITABLE.has(table)) throw new Error(`${table} is not editable from the dashboard`);
  return new Set((db().pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name));
}

const failed = (error: unknown) => ({ error: String((error as Error).message).replace(/\s+/g, " ") });

export async function save(
  table: string,
  rowid: number | null,
  values: Record<string, string>,
): Promise<Saved> {
  try {
    const named = columns(table);
    const fields = Object.entries(values)
      .filter(([column]) => named.has(column))
      .map(([column, value]) => [column, value === "" ? null : value] as const);
    if (!fields.length)
      return { error: `no writable column among ${Object.keys(values).join(", ") || "(none)"}` };

    const bound = Object.fromEntries(fields);
    if (rowid === null) {
      const names = fields.map(([c]) => c);
      rowid = Number(db().prepare(
        `INSERT INTO ${table}(${names}) VALUES(${names.map((c) => ":" + c)})`,
      ).run(bound).lastInsertRowid);
    } else if (!db().prepare(
      `UPDATE ${table} SET ${fields.map(([c]) => `${c}=:${c}`)} WHERE rowid=:rowid`,
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
    columns(table);
    if (!db().prepare(`DELETE FROM ${table} WHERE rowid=?`).run(rowid).changes)
      return { error: `no row ${rowid} in ${table}` };
    revalidatePath("/", "layout");
    return { rowid };
  } catch (error) {
    return failed(error);
  }
}
