import type { Database } from "better-sqlite3";
import { z } from "zod";

const text = z.string();
const int = z.number();
const maybeText = text.nullable();
const maybeInt = int.nullable();
const maybeReal = z.number().nullable();

const body = (ddl: string, table: string) =>
  ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\)[^;]*;`))?.[1] ?? "";

const declared = (ddl: string, table: string, column: string) => {
  const chunk = body(ddl, table)
    .split(/\n  (?=\w+\s+(?:INTEGER|TEXT|REAL)\b|CHECK\b|PRIMARY KEY\b)/)
    .find((held) => new RegExp(`^\\s*${column}\\s+(?:INTEGER|TEXT|REAL)\\b`).test(held));
  const kind = chunk?.match(/\s*\w+\s+(INTEGER|TEXT|REAL)/)?.[1] ?? "TEXT";
  return { kind, check: chunk ?? "" };
};

export const choices = (ddl: string, table: string, column: string) => {
  const { check } = declared(ddl, table, column);
  const listed = check.match(new RegExp(`${column} IN \\(([\\s\\S]*?)\\)`));
  const options = listed ? [...listed[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  return options.length ? options : null;
};

export const PROJECT_STATUS = z.enum(["shipped", "in_progress", "discontinued"]);
export const TIER = z.enum(["identity", "policy", "judgment"]);
export const STAGED_STATUS = z.enum(["ready", "blocked"]);

export const POSTING_STATUS = z.enum([
  "new", "scored", "shortlisted", "skipped", "staged",
  "applied", "interviewing", "rejected", "not_pursued", "closed",
]);

export const DISPOSITION = z.enum([
  "kept", "title", "location", "stale", "seen", "duplicate",
  "expired", "agency", "noise", "lowball",
]);

const postings = z.object({
  key: text, source: text, company: text, title: text,
  url: maybeText, location: maybeText, remote: maybeInt,
  compensation: maybeText, posted_at: maybeText, description: maybeText,
  expired: int,
  comp_min: maybeReal, comp_max: maybeReal, comp_period: maybeText, raw: maybeText,
  first_fetched: text, last_fetched: text, ingested_on: maybeText,
  disposition: DISPOSITION.nullable(), canonical_key: maybeText,
  first_seen: maybeText, last_seen: maybeText, score: maybeInt, reason: maybeText,
  resume: maybeText, status: POSTING_STATUS.nullable(),
});

export const TABLES = {
  identity: z.object({
    id: int, full_name: maybeText, preferred_name: maybeText, last_name: maybeText,
    email: maybeText, phone: maybeText, location: maybeText, street_address: maybeText,
    linkedin: maybeText, github: maybeText,
    authorized_in_country_of_residence: maybeInt,
    legal_right_to_work_without_sponsorship: maybeInt,
    requires_sponsorship_now_or_future: maybeInt, over_18: maybeInt,
    earliest_daily_start: maybeText, notice_period: maybeText,
    employment_type: maybeText, remote_preference: maybeText, willing_to_relocate: maybeInt,
    compensation_floor: maybeInt, compensation_currency: maybeText,
    gender: maybeText, race_ethnicity: maybeText, hispanic_or_latino: maybeText,
    veteran_status: maybeText, disability_status: maybeText,
  }),
  education: z.object({ id: int, degree: text, institution: maybeText, finished: maybeText }),
  employers: z.object({
    id: int, name: text, title: maybeText, start: maybeText, finish: maybeText,
    current: int, context: maybeText, seq: maybeInt,
  }),
  projects: z.object({
    id: int, employer_id: int, name: text, start: maybeText, finish: maybeText,
    status: PROJECT_STATUS.nullable(), summary: maybeText, shared_with: maybeText,
    notes: maybeText, seq: maybeInt,
  }),
  project_bullets: z.object({ project_id: int, seq: maybeInt, text }),
  project_technologies: z.object({ project_id: int, technology: text }),
  project_metrics: z.object({ project_id: int, metric: text }),
  project_links: z.object({ project_id: int, label: text, url: text }),
  search_scope: z.object({ id: int, worth_applying_to: maybeText }),
  search_titles: z.object({ value: text, seq: maybeInt }),
  events: z.object({ id: int, key: text, at: text, status: maybeText, note: maybeText }),
  staged: z.object({
    key: text, url: maybeText, screenshot: maybeText,
    status: STAGED_STATUS.nullable(), blocked_on: maybeText,
  }),
  staged_fields: z.object({
    key: text, label: text, value: maybeText, tier: TIER.nullable(), flag: maybeText,
  }),
  postings,
};

export const VIEWS = {
  prospects: postings.pick({
    key: true, company: true, title: true, url: true, location: true,
    remote: true, compensation: true, posted_at: true, first_seen: true, last_seen: true,
    source: true, description: true, score: true, reason: true, resume: true,
    status: true,
  }),
  triage: postings.pick({
    key: true, company: true, title: true, location: true, remote: true,
    compensation: true, posted_at: true, first_seen: true, source: true, score: true,
    status: true, resume: true, url: true,
  }),
  stats: z.object({ status: POSTING_STATUS.nullable(), n: int }),
  answers: z.object({
    section: text, field: text, value: z.union([text, int]).nullable(),
  }),
  unanswered: z.object({ section: text, field: text }),
  experience: z.object({ clock_starts: maybeText, years: maybeInt, relevant_years: maybeInt }),
};

export type Table = keyof typeof TABLES;
export type Rowed<T extends Table> = z.infer<(typeof TABLES)[T]> & { rowid: number };

export const withRowid = <T extends Table>(table: T) =>
  TABLES[table].extend({ rowid: int }) as unknown as z.ZodType<Rowed<T>>;

type Column = { name: string; notnull: number; pk: number; hidden: number };

const enumerated = (shape: z.ZodType): string[] | null => {
  const inner = shape instanceof z.ZodNullable ? shape.unwrap() : shape;
  return inner instanceof z.ZodEnum ? inner.options.map(String) : null;
};

export function prune(database: Database, ddl: string) {
  for (const [name, shape] of Object.entries(TABLES)) {
    const declared = Object.keys(shape.shape);
    const written = columns(ddl, name);
    for (const column of database.pragma(`table_xinfo(${name})`) as Column[])
      if (!declared.includes(column.name) && !written.includes(column.name))
        database.exec(`ALTER TABLE ${name} DROP COLUMN ${column.name}`);
  }
}

export function align(database: Database, ddl: string) {
  const wrong: string[] = [];
  for (const [name, shape] of Object.entries({ ...TABLES, ...VIEWS })) {
    const columns = database.pragma(`table_xinfo(${name})`) as Column[];
    const declared = Object.keys(shape.shape);
    const missing = columns.map((column) => column.name).filter((column) => !declared.includes(column));
    const extra = declared.filter((column) => !columns.some((held) => held.name === column));
    if (missing.length) wrong.push(`${name}: not declared — ${missing.join(", ")}`);
    if (extra.length) wrong.push(`${name}: no such column — ${extra.join(", ")}`);

    if (!(name in TABLES)) continue;
    for (const column of columns) {
      const held = shape.shape[column.name as keyof typeof shape.shape] as z.ZodType;
      if (!held) continue;
      const nullable = !column.notnull && !column.pk;
      if (!column.hidden && held.safeParse(null).success !== nullable)
        wrong.push(`${name}.${column.name}: SQL says ${nullable ? "nullable" : "NOT NULL"}`);
      const options = enumerated(held);
      const check = choices(ddl, name, column.name);
      if (options && check && String(options) !== String(check))
        wrong.push(`${name}.${column.name}: SQL allows ${check.join(", ")}`);
    }
  }
  if (wrong.length) throw new Error(`sql/*.sql has drifted from lib/schema.ts:\n${wrong.join("\n")}`);
}

const SINGLE_ROW =
  /CREATE TABLE IF NOT EXISTS (\w+) \(\s*\n\s*id\s+INTEGER PRIMARY KEY CHECK \(id = 1\)/g;

export const sections = (ddl: string) => [...ddl.matchAll(SINGLE_ROW)].map((m) => m[1]);

export const columns = (ddl: string, table: string) =>
  [...body(ddl, table).matchAll(/^ {2}(\w+)\s+(?:INTEGER|TEXT|REAL)/gm)]
    .map((m) => m[1])
    .filter((name) => name !== "id");

export const vocabulary = (ddl: string, table: string, column: string) =>
  choices(ddl, table, column) ?? [];

const SHAPES: [RegExp, string][] = [
  [/IN \(0,1\)/, "0 or 1"],
  [/>= 0/, "a whole number, 0 or more"],
  [/date\(\w+ \|\| '-01'\)/, "a year, a year and month, or a full date"],
  [/IS date\(/, "a date, as YYYY-MM-DD"],
  [/datetime\(\w+\) IS NOT NULL/, "a timestamp"],
  [/GLOB '\[0-2\]\[0-9\]:/, "a 24-hour time, as HH:MM"],
  [/GLOB '\[A-Z\]\[A-Z\]\[A-Z\]'/, "a three-letter currency code, like USD"],
  [/LIKE '_%@_%\._%'/, "an email address"],
  [/LIKE 'http%:\/\/%\.%'/, "a URL, starting http"],
  [/NOT \w+ GLOB '\*\[A-Za-z\]\*'/, "a phone number — digits and separators, no words"],
];

export function takes(ddl: string, table: string, column: string) {
  const listed = choices(ddl, table, column);
  if (listed) return `one of ${listed.join(", ")}`;
  const { kind, check } = declared(ddl, table, column);
  const shape = SHAPES.find(([pattern]) => pattern.test(check));
  if (shape) return shape[1];
  return kind === "INTEGER" ? "a whole number" : "anything but an empty answer";
}
