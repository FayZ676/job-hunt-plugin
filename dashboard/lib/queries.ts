import { z } from "zod";

import { one, rows } from "./db";
import {
  CRITERION, PROJECT_STATUS, SECTION, TABLES, VIEWS, withRowid,
  type Rowed, type Table,
} from "./schema";

const listing = <T extends Table>(table: T, order = "") =>
  rows(withRowid(table), `SELECT rowid AS rowid, * FROM ${table} ${order}`);

export type Field = Rowed<"profile">;
export type Bullet = Rowed<"project_bullets">;
export type Project = Rowed<"projects"> & {
  bullets: Bullet[];
  technologies: Rowed<"project_technologies">[];
  metrics: Rowed<"project_metrics">[];
  links: Rowed<"project_links">[];
};
export type Employer = Rowed<"employers"> & { projects: Project[] };

export const fields = () => listing("profile", "ORDER BY section, field");
export const education = () => listing("education");
export const criteria = () => listing("search_criteria", "ORDER BY kind, seq IS NULL, seq, value");
export const notes = () => listing("search_notes", "ORDER BY topic");
export const facts = () => listing("facts", "ORDER BY rowid");
export const limits = () => listing("company_limits", "ORDER BY company");
export const accounts = () => listing("accounts", "ORDER BY employer");

export const jobs = () => rows(VIEWS.triage, "SELECT * FROM triage");
export const stats = () => rows(VIEWS.stats, "SELECT status, n FROM stats");
export const companies = () => rows(TABLES.companies, "SELECT * FROM companies ORDER BY ats, name");

export function career(): Employer[] {
  const bullets = listing("project_bullets", "ORDER BY project_id, seq IS NULL, seq, rowid");
  const technologies = listing("project_technologies", "ORDER BY project_id, technology");
  const metrics = listing("project_metrics", "ORDER BY project_id, rowid");
  const links = listing("project_links", "ORDER BY project_id, rowid");
  const under = <T extends { project_id: number }>(all: T[], project: number) =>
    all.filter((row) => row.project_id === project);

  const projects = listing("projects", "ORDER BY seq IS NULL, seq, rowid").map((project) => ({
    ...project,
    bullets: under(bullets, project.rowid),
    technologies: under(technologies, project.rowid),
    metrics: under(metrics, project.rowid),
    links: under(links, project.rowid),
  }));

  return listing("employers", "ORDER BY seq IS NULL, seq, rowid").map((employer) => ({
    ...employer,
    projects: projects.filter((project) => project.employer_id === employer.rowid),
  }));
}

const STAGED = TABLES.staged.omit({ key: true });
const ANSWER = TABLES.staged_fields.omit({ key: true });
const EVENT = TABLES.events.pick({ at: true, status: true, note: true });

export type Job = z.infer<typeof VIEWS.triage>;
export type Company = z.infer<typeof TABLES.companies>;
export type Posting = z.infer<typeof VIEWS.prospects>;
export type Prospect = {
  posting: Posting;
  events: z.infer<typeof EVENT>[];
  staged: z.infer<typeof STAGED> | null;
  fields: z.infer<typeof ANSWER>[];
  aliases: string[];
};

export function prospect(key: string): Prospect | null {
  const posting = one(VIEWS.prospects, "SELECT * FROM prospects WHERE key=?", [key]);
  if (!posting) return null;
  return {
    posting,
    events: rows(EVENT, "SELECT at, status, note FROM events WHERE key=? ORDER BY id", [key]),
    staged: one(STAGED, "SELECT url, ats, screenshot, status, blocked_on FROM staged WHERE key=?", [key]),
    fields: rows(ANSWER, "SELECT label, value, tier, flag FROM staged_fields WHERE key=? ORDER BY rowid", [key]),
    aliases: rows(z.object({ key: z.string() }),
                  "SELECT key FROM postings WHERE canonical_key=?", [key]).map((row) => row.key),
  };
}

export const vocabularies = () => ({
  section: SECTION.options,
  kind: CRITERION.options,
  status: PROJECT_STATUS.options,
});
