import type { Database } from "better-sqlite3";
import { z } from "zod";

type Column = { sql?: string; takes?: string; kind?: string; note?: string };
type Shape = {
  note?: string;
  constraints?: string[];
  indexes?: string[];
  singleRow?: boolean;
};

const col = <T extends z.ZodType>(shape: T, meta: Column = {}) => shape.meta(meta) as T;
const dated = "a year, a year and month, or a full date";

const since = (name: string) =>
  `CHECK (${name} IS date(${name}) OR date(${name} || '-01') IS NOT NULL ` +
  `OR date(${name} || '-01-01') IS NOT NULL)`;

const filled = (name: string) => `CHECK (trim(${name}) <> '')`;
const url = (name: string) => `CHECK (${name} LIKE 'http%://%.%')`;
const owned = (by: string) => `REFERENCES ${by} ON DELETE CASCADE`;

export const TABLES = {
  settings: z.object({
    key: col(z.string(), { sql: "PRIMARY KEY" }),
    value: z.string().nullable(),
  }),

  filters: z
    .object({
      kind: z.enum([
        "title_include",
        "title_exclude",
        "location_include",
        "location_exclude",
        "us_tokens",
        "title_noise",
        "agency_name_patterns",
        "agency_blocklist",
      ]),
      pattern: z.string(),
      note: z.string().nullable(),
    })
    .meta({ constraints: ["PRIMARY KEY (kind, pattern)"] } satisfies Shape),

  postings: z
    .object({
      key: col(z.string(), { sql: "PRIMARY KEY" }),
      source: z.string(),
      company: z.string(),
      title: z.string(),
      url: col(z.string().nullable(), {
        sql: url("url"),
        takes: "a URL, starting http",
      }),
      location: z.string().nullable(),
      remote: col(z.number().nullable(), {
        sql: "CHECK (remote IN (0,1))",
        takes: "0 or 1",
      }),
      compensation: z.string().nullable(),
      posted_at: col(z.string().nullable(), {
        sql: "CHECK (posted_at IS NULL OR datetime(posted_at) IS NOT NULL)",
        takes: "a timestamp",
      }),
      description: z.string().nullable(),
      expired: col(z.number(), {
        sql: "DEFAULT 0 CHECK (expired IN (0,1))",
        takes: "0 or 1",
      }),
      comp_min: col(z.number().nullable(), {
        kind: "REAL",
        sql: "CHECK (comp_min >= 0)",
      }),
      comp_max: col(z.number().nullable(), {
        kind: "REAL",
        sql: "CHECK (comp_max >= 0)",
      }),
      comp_period: z.enum(["HOURLY", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]).nullable(),
      raw: z.string().nullable(),
      first_fetched: col(z.string(), {
        sql: "DEFAULT (date('now')) CHECK (first_fetched IS date(first_fetched))",
        takes: "a date, as YYYY-MM-DD",
      }),
      last_fetched: col(z.string(), {
        sql: "DEFAULT (date('now')) CHECK (last_fetched IS date(last_fetched))",
        takes: "a date, as YYYY-MM-DD",
      }),
      ingested_on: col(z.string().nullable(), {
        sql: "CHECK (ingested_on IS date(ingested_on))",
        takes: "a date, as YYYY-MM-DD",
      }),
      disposition: z
        .enum(["kept", "title", "location", "stale", "seen", "duplicate", "expired", "agency", "noise", "lowball"])
        .nullable(),
      canonical_key: col(z.string().nullable(), {
        sql: "REFERENCES postings(key) ON DELETE SET NULL",
      }),
      first_seen: col(z.string().nullable(), {
        sql: "CHECK (first_seen IS date(first_seen))",
        takes: "a date, as YYYY-MM-DD",
      }),
      last_seen: col(z.string().nullable(), {
        sql: "CHECK (last_seen IS date(last_seen))",
        takes: "a date, as YYYY-MM-DD",
      }),
      score: col(z.number().nullable(), {
        sql: "CHECK (score IS NULL OR score BETWEEN 0 AND 10)",
      }),
      reason: z.string().nullable(),
      resume: z.string().nullable(),
      status: z
        .enum([
          "new",
          "scored",
          "shortlisted",
          "skipped",
          "staged",
          "applied",
          "interviewing",
          "rejected",
          "not_pursued",
          "closed",
        ])
        .nullable(),
    })
    .meta({
      constraints: [
        "CHECK (disposition IS NOT 'kept' OR canonical_key IS NULL)",
        "CHECK (canonical_key IS NULL OR canonical_key <> key)",
        "CHECK (disposition IS 'kept' OR (status IS NULL AND score IS NULL AND reason IS NULL\n" +
          "                                   AND resume IS NULL AND first_seen IS NULL))",
      ],
      indexes: [
        "idx_postings_pending ON postings(disposition, last_fetched)",
        "idx_postings_status ON postings(status)",
        "idx_postings_seen ON postings(first_seen)",
        "idx_postings_canonical ON postings(canonical_key)",
      ],
    } satisfies Shape),

  events: z
    .object({
      id: col(z.number(), { sql: "PRIMARY KEY AUTOINCREMENT" }),
      key: col(z.string(), { sql: owned("postings(key)") }),
      at: col(z.string(), {
        sql: "DEFAULT (datetime('now')) CHECK (datetime(at) IS NOT NULL)",
        takes: "a timestamp",
      }),
      status: z.string().nullable(),
      note: z.string().nullable(),
    })
    .meta({
      note: "History. Written by the triggers in logic.sql, never by hand.",
      indexes: ["idx_events_key ON events(key)"],
    } satisfies Shape),

  staged: z.object({
    key: col(z.string(), {
      sql: "PRIMARY KEY REFERENCES postings(key) ON DELETE CASCADE",
    }),
    url: col(z.string().nullable(), {
      sql: url("url"),
      takes: "a URL, starting http",
    }),
    screenshot: z.string().nullable(),
    status: z.enum(["ready", "blocked"]).nullable(),
    blocked_on: z.string().nullable(),
  }),

  staged_fields: z.object({
    key: col(z.string(), { sql: owned("postings(key)") }),
    label: z.string(),
    value: z.string().nullable(),
    tier: z.enum(["identity", "policy", "judgment"]).nullable(),
    flag: z.string().nullable(),
  }),

  identity: z
    .object({
      full_name: col(z.string().nullable(), { sql: filled("full_name") }),
      preferred_name: col(z.string().nullable(), {
        sql: filled("preferred_name"),
      }),
      last_name: col(z.string().nullable(), { sql: filled("last_name") }),
      email: col(z.string().nullable(), {
        sql: "CHECK (email LIKE '_%@_%._%')",
        takes: "an email address",
      }),
      phone: col(z.string().nullable(), {
        sql: "CHECK (NOT phone GLOB '*[A-Za-z]*' AND length(phone) >= 7)",
        takes: "a phone number — digits and separators, no words",
      }),
      location: col(z.string().nullable(), { sql: filled("location") }),
      street_address: col(z.string().nullable(), {
        sql: filled("street_address"),
      }),
      linkedin: col(z.string().nullable(), {
        sql: url("linkedin"),
        takes: "a URL, starting http",
      }),
      github: col(z.string().nullable(), {
        sql: url("github"),
        takes: "a URL, starting http",
      }),

      authorized_in_country_of_residence: col(z.number().nullable(), {
        sql: "CHECK (authorized_in_country_of_residence IN (0,1))",
        takes: "0 or 1",
      }),
      legal_right_to_work_without_sponsorship: col(z.number().nullable(), {
        sql: "CHECK (legal_right_to_work_without_sponsorship IN (0,1))",
        takes: "0 or 1",
      }),
      requires_sponsorship_now_or_future: col(z.number().nullable(), {
        sql: "CHECK (requires_sponsorship_now_or_future IN (0,1))",
        takes: "0 or 1",
      }),
      over_18: col(z.number().nullable(), {
        sql: "CHECK (over_18 IN (0,1))",
        takes: "0 or 1",
      }),

      earliest_daily_start: col(z.string().nullable(), {
        sql:
          "CHECK (earliest_daily_start GLOB '[0-2][0-9]:[0-5][0-9]'\n" +
          "                                       AND earliest_daily_start <= '23:59')",
        takes: "a 24-hour time, as HH:MM",
      }),
      notice_period: z.enum(["none", "1_week", "2_weeks", "3_weeks", "1_month", "2_months", "3_months"]).nullable(),
      employment_type: z.enum(["full_time", "part_time", "contract", "internship", "temporary"]).nullable(),
      remote_preference: z.enum(["remote", "hybrid", "on_site", "no_preference"]).nullable(),
      willing_to_relocate: col(z.number().nullable(), {
        sql: "CHECK (willing_to_relocate IN (0,1))",
        takes: "0 or 1",
      }),
      compensation_floor: col(z.number().nullable(), {
        sql: "CHECK (compensation_floor >= 0)",
        takes: "a whole number, 0 or more",
      }),
      compensation_currency: col(z.string().nullable(), {
        sql: "CHECK (compensation_currency GLOB '[A-Z][A-Z][A-Z]')",
        takes: "a three-letter currency code, like USD",
      }),

      gender: z.enum(["male", "female", "non_binary", "decline_to_say"]).nullable(),
      race_ethnicity: z
        .enum([
          "american_indian_or_alaska_native",
          "asian",
          "black_or_african_american",
          "hispanic_or_latino",
          "native_hawaiian_or_pacific_islander",
          "white",
          "two_or_more_races",
          "decline_to_say",
        ])
        .nullable(),
      hispanic_or_latino: z.enum(["yes", "no", "decline_to_say"]).nullable(),
      veteran_status: z.enum(["protected_veteran", "not_a_protected_veteran", "decline_to_say"]).nullable(),
      disability_status: z.enum(["yes", "no", "decline_to_say"]).nullable(),
    })
    .meta({
      singleRow: true,
      note:
        "Who the applicant is, in the order a form asks: contact, then the yes/no\n" +
        "questions every form repeats, then when you could start, then the optional\n" +
        "ones. Declining to say is a real answer rather than a missing one, which is\n" +
        "why the last five are choices and not flags.",
    } satisfies Shape),

  education: z
    .object({
      id: col(z.number(), { sql: "PRIMARY KEY AUTOINCREMENT" }),
      degree: col(z.string(), { sql: filled("degree") }),
      institution: col(z.string().nullable(), { sql: filled("institution") }),
      finished: col(z.string().nullable(), {
        sql: since("finished"),
        takes: dated,
      }),
    })
    .meta({
      note:
        "`finished` and the career dates below are as precise as the user was: a year,\n" +
        "a year and month, or a full date. A resume prints months, so demanding a day\n" +
        "would invent one.",
    } satisfies Shape),

  employers: z
    .object({
      id: col(z.number(), { sql: "PRIMARY KEY AUTOINCREMENT" }),
      name: col(z.string(), { sql: filled("name") }),
      title: col(z.string().nullable(), { sql: filled("title") }),
      start: col(z.string().nullable(), { sql: since("start"), takes: dated }),
      finish: col(z.string().nullable(), {
        sql: since("finish"),
        takes: dated,
      }),
      current: col(z.number(), {
        sql: "DEFAULT 0 CHECK (current IN (0,1))",
        takes: "0 or 1",
      }),
      context: z.string().nullable(),
      seq: col(z.number().nullable(), {
        sql: "CHECK (seq >= 0)",
        takes: "a whole number, 0 or more",
      }),
    })
    .meta({
      constraints: ["CHECK (current = 0 OR finish IS NULL)"],
    } satisfies Shape),

  projects: z
    .object({
      id: col(z.number(), { sql: "PRIMARY KEY AUTOINCREMENT" }),
      employer_id: col(z.number(), { sql: owned("employers(id)") }),
      name: col(z.string(), { sql: filled("name") }),
      start: col(z.string().nullable(), { sql: since("start"), takes: dated }),
      finish: col(z.string().nullable(), {
        sql: since("finish"),
        takes: dated,
      }),
      status: z.enum(["shipped", "in_progress", "discontinued"]).nullable(),
      summary: z.string().nullable(),
      shared_with: col(z.string().nullable(), {
        note: "'one other engineer' — how shared work stays honest",
      }),
      notes: z.string().nullable(),
      seq: col(z.number().nullable(), {
        sql: "CHECK (seq >= 0)",
        takes: "a whole number, 0 or more",
      }),
    })
    .meta({
      note:
        "The only source a resume may draw from. A correction lives on the row it corrects --\n" +
        "a wrong number in `project_metrics`, a wrong title on `employers`, everything else\n" +
        "in `notes` -- so there is one place to read and nothing to reconcile.",
    } satisfies Shape),

  project_bullets: z.object({
    project_id: col(z.number(), { sql: owned("projects(id)") }),
    seq: col(z.number().nullable(), {
      sql: "CHECK (seq >= 0)",
      takes: "a whole number, 0 or more",
    }),
    text: col(z.string(), { sql: filled("text") }),
  }),

  project_technologies: z
    .object({
      project_id: col(z.number(), { sql: owned("projects(id)") }),
      technology: z.string(),
    })
    .meta({
      note: "What a JD is matched against when selecting bullets.",
      constraints: ["PRIMARY KEY (project_id, technology)"],
    } satisfies Shape),

  project_metrics: z.object({
    project_id: col(z.number(), { sql: owned("projects(id)") }),
    metric: z.string(),
  }),

  project_links: z.object({
    project_id: col(z.number(), { sql: owned("projects(id)") }),
    label: col(z.string(), { sql: filled("label") }),
    url: col(z.string(), { sql: url("url"), takes: "a URL, starting http" }),
  }),

  instructions: z
    .object({
      text: col(z.string().nullable(), { sql: filled("text") }),
    })
    .meta({
      singleRow: true,
      note:
        "What to do with everything above: the prose the search is typed from and\n" +
        "every score is judged against. One reader reads it, and typed columns only\n" +
        "flatten the slopes it describes into walls.",
    } satisfies Shape),
};

export type Table = keyof typeof TABLES;

export const ORDER: Table[] = [
  "settings",
  "filters",
  "postings",
  "events",
  "staged",
  "staged_fields",
  "identity",
  "education",
  "employers",
  "projects",
  "project_bullets",
  "project_technologies",
  "project_metrics",
  "project_links",
  "instructions",
];

const int = z.number();
const text = z.string();

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
    clock_starts: text.nullable(),
    years: int.nullable(),
    relevant_years: int.nullable(),
  }),
};

export const DERIVED: Partial<Record<keyof typeof VIEWS, { where: string; order?: string }>> = {
  prospects: { where: "disposition = 'kept'" },
  triage: {
    where: "disposition = 'kept'",
    order: "COALESCE(score,-1) DESC, first_seen DESC",
  },
};

export type Rowed<T extends Table> = z.infer<(typeof TABLES)[T]> & {
  rowid: number;
};

export const withRowid = <T extends Table>(table: T) =>
  TABLES[table].extend({ rowid: int }) as unknown as z.ZodType<Rowed<T>>;

const bare = (shape: z.ZodType): z.ZodType =>
  shape instanceof z.ZodNullable ? bare(shape.unwrap() as z.ZodType) : shape;

export const options = (table: Table, column: string): string[] => {
  const held = TABLES[table].shape[column as never] as z.ZodType | undefined;
  const inner = held && bare(held);
  return inner instanceof z.ZodEnum ? inner.options.map(String) : [];
};

export const SECTIONS = ORDER.filter((table) => (TABLES[table].meta() as Shape | undefined)?.singleRow);

export const columns = (table: Table) => Object.keys(TABLES[table].shape);

export function takes(table: Table, column: string) {
  const listed = options(table, column);
  if (listed.length) return `one of ${listed.join(", ")}`;
  const held = TABLES[table].shape[column as never] as z.ZodType | undefined;
  const said = (held?.meta() as Column | undefined)?.takes;
  if (said) return said;
  return bare(held ?? text) instanceof z.ZodNumber ? "a whole number" : "anything but an empty answer";
}

type Held = { name: string; notnull: number; pk: number; hidden: number };

export function align(database: Database) {
  const wrong: string[] = [];
  for (const [name, shape] of Object.entries({ ...TABLES, ...VIEWS })) {
    const found = database.pragma(`table_xinfo(${name})`) as Held[];
    const declared = Object.keys(shape.shape);
    const single = (shape.meta() as Shape | undefined)?.singleRow;
    const expected = single ? ["id", ...declared] : declared;

    const missing = found.map((column) => column.name).filter((column) => !expected.includes(column));
    const extra = expected.filter((column) => !found.some((held) => held.name === column));
    if (missing.length) wrong.push(`${name}: not declared — ${missing.join(", ")}`);
    if (extra.length) wrong.push(`${name}: no such column — ${extra.join(", ")}`);

    if (!(name in TABLES)) continue;
    for (const column of found) {
      const held = shape.shape[column.name as never] as z.ZodType | undefined;
      if (!held || column.hidden) continue;
      const nullable = !column.notnull && !column.pk;
      if (held.safeParse(null).success !== nullable)
        wrong.push(`${name}.${column.name}: SQL says ${nullable ? "nullable" : "NOT NULL"}`);
    }
  }
  if (wrong.length)
    throw new Error(
      `the database has drifted from lib/core/schema.ts:\n${wrong.join("\n")}\n\n` +
        "Nothing migrates on connect, and no job-* command can open a database this refused. " +
        "Migrate it with sqlite3 directly: DROP COLUMN one the database has and nothing " +
        "declares, ADD COLUMN one that is declared and the database lacks.",
    );
}
