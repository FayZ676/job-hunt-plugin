import { z } from "zod";

import { DERIVED, ORDER, TABLES, VIEWS } from "./schema.ts";

type Column = { sql?: string; takes?: string; kind?: string; note?: string };
type Shape = {
  note?: string;
  constraints?: string[];
  indexes?: string[];
  singleRow?: boolean;
};

const bare = (shape: z.ZodType): z.ZodType =>
  shape instanceof z.ZodNullable ? bare(shape.unwrap() as z.ZodType) : shape;

const kindOf = (shape: z.ZodType, said?: string) => said ?? (bare(shape) instanceof z.ZodNumber ? "INTEGER" : "TEXT");

const packed = (parts: string[], width: number, join: string) => {
  const lines: string[] = [];
  let line = "";
  for (const held of parts) {
    if (line && line.length + held.length + join.length > width) {
      lines.push(line);
      line = "";
    }
    line += (line ? join : "") + held;
  }
  if (line) lines.push(line);
  return lines;
};

const enumCheck = (name: string, shape: z.ZodType) => {
  const inner = bare(shape);
  if (!(inner instanceof z.ZodEnum)) return "";
  const listed = inner.options.map((held) => `'${String(held)}'`);
  const one = `CHECK (${name} IN (${listed.join(",")}))`;
  if (one.length <= 92) return one;
  const pad = " ".repeat(18);
  return `CHECK (${name} IN (\n${packed(listed, 62, ",")
    .map((held) => pad + held)
    .join(",\n")}))`;
};

function declare(table: string, shape: z.ZodObject) {
  const meta = (shape.meta() ?? {}) as Shape;
  const fields = Object.entries(shape.shape) as [string, z.ZodType][];
  const width = Math.max(...fields.map(([name]) => name.length), meta.singleRow ? 2 : 0);

  const lines: { body: string; note?: string }[] = fields.map(([name, held]) => {
    const column = (held.meta() ?? {}) as Column;
    const nullable = held.safeParse(null).success;
    const parts = [
      kindOf(held, column.kind),
      !nullable && !column.sql?.includes("PRIMARY KEY") ? "NOT NULL" : "",
      column.sql ?? "",
      enumCheck(name, held),
    ].filter(Boolean);
    return {
      body: `  ${name.padEnd(width)} ${parts.join(" ")}`,
      note: column.note,
    };
  });

  if (meta.singleRow)
    lines.unshift({
      body: `  ${"id".padEnd(width)} INTEGER PRIMARY KEY CHECK (id = 1)`,
    });

  for (const held of meta.constraints ?? []) lines.push({ body: `  ${held}` });

  const rendered = lines
    .map((held, n) => held.body + (n < lines.length - 1 ? "," : "") + (held.note ? `             -- ${held.note}` : ""))
    .join("\n");

  const note = meta.note
    ? meta.note
        .split("\n")
        .map((l) => `-- ${l}`)
        .join("\n") + "\n"
    : "";
  const seed = meta.singleRow ? `\nINSERT OR IGNORE INTO ${table}(id) VALUES (1);` : "";
  const indexes = (meta.indexes ?? []).map((held) => `\nCREATE INDEX IF NOT EXISTS ${held};`).join("");

  return `${note}CREATE TABLE IF NOT EXISTS ${table} (\n${rendered}\n) STRICT;${seed}${indexes}`;
}

const view = (name: keyof typeof VIEWS) => {
  const spec = DERIVED[name]!;
  const listed = Object.keys((VIEWS[name] as z.ZodObject).shape);
  return (
    `DROP VIEW IF EXISTS ${name};\nCREATE VIEW ${name} AS\n  SELECT ` +
    packed(listed, 62, ", ").join(",\n         ") +
    `\n  FROM postings WHERE ${spec.where}` +
    (spec.order ? `\n  ORDER BY ${spec.order}` : "") +
    ";"
  );
};

const answers = () => {
  const pairs = Object.keys(TABLES.identity.shape).map((held) => `'${held}', ${held}`);
  return `-- Every question a form could ask, and whatever the profile says back. Phase 4
-- checks \`unanswered\` before staging; anything listed there blocks rather than
-- gets guessed. Generated from the identity shape, so a column added there
-- appears here on the next connect.
DROP VIEW IF EXISTS unanswered;
DROP VIEW IF EXISTS answers;
CREATE VIEW IF NOT EXISTS answers AS
  SELECT section, answer.key AS field, answer.value AS value FROM (
    SELECT 'identity' AS section, json_object(
${packed(pairs, 74, ", ")
  .map((held) => "             " + held)
  .join(",\n")}) AS row
      FROM identity
    UNION ALL SELECT 'experience', json_object(
             'years', years, 'relevant_years', relevant_years,
             'clock_starts', clock_starts) FROM experience
  ), json_each(row) AS answer;

CREATE VIEW IF NOT EXISTS unanswered AS
  SELECT section, field FROM answers WHERE value IS NULL;`;
};

export const tables = () =>
  [
    "PRAGMA journal_mode=WAL;",
    "PRAGMA foreign_keys=ON;",
    "",
    ...ORDER.map((table) => declare(table, TABLES[table] as z.ZodObject) + "\n"),
    (Object.keys(DERIVED) as (keyof typeof VIEWS)[]).map(view).join("\n\n"),
    "",
    answers(),
    "",
  ].join("\n");
