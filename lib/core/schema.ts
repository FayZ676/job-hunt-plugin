import type { Database } from "better-sqlite3";
import { z } from "zod";

import { choices } from "./ddl.ts";
import { TABLES } from "./tables.generated.ts";

export { TABLES };

const text = z.string();
const int = z.number();
const maybeText = text.nullable();
const maybeInt = int.nullable();

export const VIEWS = {
  prospects: TABLES.postings.pick({
    key: true,
    company: true,
    title: true,
    url: true,
    location: true,
    remote: true,
    compensation: true,
    posted_at: true,
    first_seen: true,
    last_seen: true,
    source: true,
    description: true,
    score: true,
    reason: true,
    resume: true,
    status: true,
  }),
  triage: TABLES.postings.pick({
    key: true,
    company: true,
    title: true,
    location: true,
    remote: true,
    compensation: true,
    posted_at: true,
    first_seen: true,
    source: true,
    score: true,
    status: true,
    resume: true,
    url: true,
  }),
  stats: z.object({ status: TABLES.postings.shape.status, n: int }),
  answers: z.object({
    section: text,
    field: text,
    value: z.union([text, int]).nullable(),
  }),
  unanswered: z.object({ section: text, field: text }),
  experience: z.object({
    clock_starts: maybeText,
    years: maybeInt,
    relevant_years: maybeInt,
  }),
};

export type Table = keyof typeof TABLES;
export type Rowed<T extends Table> = z.infer<(typeof TABLES)[T]> & {
  rowid: number;
};

export const withRowid = <T extends Table>(table: T) =>
  TABLES[table].extend({ rowid: int }) as unknown as z.ZodType<Rowed<T>>;

type Column = { name: string; notnull: number; pk: number; hidden: number };

const enumerated = (shape: z.ZodType): string[] | null => {
  const inner = shape instanceof z.ZodNullable ? shape.unwrap() : shape;
  return inner instanceof z.ZodEnum ? inner.options.map(String) : null;
};

export function align(database: Database, ddl: string) {
  const wrong: string[] = [];
  for (const [name, shape] of Object.entries({ ...TABLES, ...VIEWS })) {
    const columns = database.pragma(`table_xinfo(${name})`) as Column[];
    const declared = Object.keys(shape.shape);
    const missing = columns
      .map((column) => column.name)
      .filter((column) => !declared.includes(column));
    const extra = declared.filter(
      (column) => !columns.some((held) => held.name === column),
    );
    if (missing.length)
      wrong.push(`${name}: not declared — ${missing.join(", ")}`);
    if (extra.length)
      wrong.push(`${name}: no such column — ${extra.join(", ")}`);

    if (!(name in TABLES)) continue;
    for (const column of columns) {
      const held = shape.shape[
        column.name as keyof typeof shape.shape
      ] as z.ZodType;
      if (!held) continue;
      const nullable = !column.notnull && !column.pk;
      if (!column.hidden && held.safeParse(null).success !== nullable)
        wrong.push(
          `${name}.${column.name}: SQL says ${nullable ? "nullable" : "NOT NULL"}`,
        );
      const options = enumerated(held);
      const check = choices(ddl, name, column.name);
      if (options && check && String(options) !== String(check))
        wrong.push(`${name}.${column.name}: SQL allows ${check.join(", ")}`);
    }
  }
  if (wrong.length)
    throw new Error(
      `sql/*.sql has drifted from lib/core/schema.ts:\n${wrong.join("\n")}\n\n` +
        "Nothing migrates on connect, and no job-* command can open a database this refused. " +
        "Migrate it with sqlite3 directly: DROP COLUMN one the database has and nothing " +
        "declares, ADD COLUMN one that is declared and the database lacks.",
    );
}
