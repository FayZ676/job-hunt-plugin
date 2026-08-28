import type { Database } from "better-sqlite3";
import { z } from "zod";

const text = z.string();
const int = z.number();
const maybeText = text.nullable();
const maybeInt = int.nullable();
const maybeReal = z.number().nullable();

export const SECTION = z.enum([
  "identity", "work_authorization", "availability", "compensation",
  "demographics", "experience", "search",
]);

export const FIELD = z.enum([
  "identity.full_name", "identity.preferred_name", "identity.last_name", "identity.email",
  "identity.phone", "identity.location", "identity.street_address", "identity.linkedin",
  "identity.github", "work_authorization.authorized_in_country_of_residence",
  "work_authorization.legal_right_to_work_without_sponsorship",
  "work_authorization.requires_sponsorship_now_or_future", "work_authorization.over_18",
  "availability.earliest_start", "availability.earliest_daily_start",
  "availability.notice_period", "availability.employment_type", "availability.remote_preference",
  "availability.willing_to_relocate", "compensation.floor", "compensation.currency",
  "demographics.gender", "demographics.race_ethnicity", "demographics.hispanic_or_latino",
  "demographics.veteran_status", "demographics.disability_status", "experience.years",
  "experience.relevant_years", "experience.clock_starts", "search.home_metro",
  "search.relocation",
]);

export const CRITERION = z.enum([
  "title_preferred", "title_acceptable", "title_excluded", "title_penalty",
  "score_up", "score_down", "dealbreaker", "brings", "location_tier",
  "experience_floor", "level",
]);

export const PROJECT_STATUS = z.enum(["shipped", "in_progress", "discontinued"]);
export const CADENCE = z.enum(["Weekly", "Monthly", "Quarterly"]);
export const TIER = z.enum(["identity", "policy", "judgment"]);
export const STAGED_STATUS = z.enum(["ready", "blocked"]);

export const POSTING_STATUS = z.enum([
  "new", "scored", "shortlisted", "skipped", "staged",
  "applied", "interviewing", "rejected", "not_pursued", "closed",
]);

export const DISPOSITION = z.enum([
  "kept", "upgraded", "title", "location", "stale", "seen", "duplicate",
  "sponsored", "expired", "agency", "noise", "lowball", "covered",
]);

const postings = z.object({
  key: text, source: text, ats: maybeText, company: text, title: text,
  url: maybeText, apply_url: maybeText, location: maybeText, remote: maybeInt,
  compensation: maybeText, posted_at: maybeText, description: maybeText,
  sponsored: int, expired: int,
  comp_min: maybeReal, comp_max: maybeReal, comp_period: maybeText, raw: maybeText,
  first_fetched: text, last_fetched: text, ingested_on: maybeText,
  disposition: DISPOSITION.nullable(), canonical_key: maybeText,
  first_seen: maybeText, last_seen: maybeText, score: maybeInt, reason: maybeText,
  resume: maybeText, status: POSTING_STATUS.nullable(),
});

export const TABLES = {
  profile: z.object({ field: FIELD, value: maybeText, section: SECTION }),
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
  search_criteria: z.object({
    kind: CRITERION, value: text, weight: maybeInt, note: maybeText, seq: maybeInt,
  }),
  search_notes: z.object({ topic: text, note: text }),
  facts: z.object({ id: int, fact: text }),
  company_limits: z.object({ company: text, stated: text }),
  accounts: z.object({
    employer: text, system: maybeText, portal_url: maybeText, login_email: maybeText,
    password_location: maybeText, created: maybeText,
  }),
  companies: z.object({
    slug: text, ats: text, name: text, active: int, added_on: maybeText,
    source: maybeText, careers_url: maybeText, cadence: CADENCE.nullable(),
    last_checked: maybeText,
  }),
  events: z.object({ id: int, key: text, at: text, status: maybeText, note: maybeText }),
  staged: z.object({
    key: text, url: maybeText, ats: maybeText, screenshot: maybeText,
    status: STAGED_STATUS.nullable(), blocked_on: maybeText,
  }),
  staged_fields: z.object({
    key: text, label: text, value: maybeText, tier: TIER.nullable(), flag: maybeText,
  }),
  postings,
};

export const VIEWS = {
  prospects: postings.pick({
    key: true, company: true, title: true, url: true, apply_url: true, location: true,
    remote: true, compensation: true, posted_at: true, first_seen: true, last_seen: true,
    source: true, ats: true, description: true, score: true, reason: true, resume: true,
    status: true,
  }),
  triage: postings.pick({
    key: true, company: true, title: true, location: true, remote: true,
    compensation: true, posted_at: true, first_seen: true, source: true, score: true,
    status: true, resume: true, url: true,
  }),
  stats: z.object({ status: POSTING_STATUS.nullable(), n: int }),
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

const listed = (ddl: string, table: string, column: string) => {
  const body = ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`));
  const check = body?.[1].match(new RegExp(`${column}\\s+TEXT[\\s\\S]*?IN \\(([\\s\\S]*?)\\)\\)`));
  return check ? [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : null;
};

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
      const check = listed(ddl, name, column.name);
      if (options && check && String(options) !== String(check))
        wrong.push(`${name}.${column.name}: SQL allows ${check.join(", ")}`);
    }
  }
  if (wrong.length) throw new Error(`sql/*.sql has drifted from lib/schema.ts:\n${wrong.join("\n")}`);
}
