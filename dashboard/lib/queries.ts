import { one, rows, vocabulary, type Row } from "./db";

export type Field = { rowid: number; field: string; value: string | null; notes: string | null; section: string };
export type Bullet = { rowid: number; project_id: number; text: string; seq: number | null };
export type Named = { rowid: number; project_id: number } & Record<string, string>;
export type Link = { rowid: number; project_id: number; label: string; url: string };

export type Project = {
  rowid: number; employer_id: number; name: string;
  start: string | null; finish: string | null; status: string | null;
  summary: string | null; shared_with: string | null; notes: string | null; seq: number | null;
  bullets: Bullet[]; technologies: Named[]; metrics: Named[]; links: Link[];
};

export type Employer = {
  rowid: number; name: string; title: string | null;
  start: string | null; finish: string | null; current: number;
  context: string | null; seq: number | null; projects: Project[];
};

export const fields = () =>
  rows<Field>("SELECT rowid AS rowid, field, value, section, notes FROM profile ORDER BY section, field");

export const education = () =>
  rows("SELECT rowid AS rowid, degree, institution, finished FROM education");

export const criteria = () =>
  rows("SELECT rowid AS rowid, kind, value, weight, note, seq FROM search_criteria" +
       " ORDER BY kind, seq IS NULL, seq, value");

export const notes = () => rows("SELECT rowid AS rowid, topic, note FROM search_notes ORDER BY topic");
export const facts = () => rows("SELECT rowid AS rowid, fact FROM facts ORDER BY rowid");
export const limits = () => rows("SELECT rowid AS rowid, company, stated FROM company_limits ORDER BY company");
export const accounts = () =>
  rows("SELECT rowid AS rowid, employer, system, portal_url, login_email, password_location, created" +
       " FROM accounts ORDER BY employer");

export const jobs = () => rows("SELECT * FROM triage");
export const stats = () => rows<{ status: string; n: number }>("SELECT status, n FROM stats");
export const companies = () =>
  rows("SELECT slug, ats, name, active, source, careers_url, cadence, last_checked" +
       " FROM companies ORDER BY ats, name");

export function career(): Employer[] {
  const employers = rows<Employer>(
    "SELECT rowid AS rowid, name, title, start, finish, current, context, seq" +
    " FROM employers ORDER BY seq IS NULL, seq, rowid");
  const projects = rows<Project>(
    "SELECT rowid AS rowid, employer_id, name, start, finish, status, summary, shared_with, notes, seq" +
    " FROM projects ORDER BY seq IS NULL, seq, rowid");
  const children = {
    bullets: rows<Bullet>("SELECT rowid AS rowid, project_id, text, seq FROM project_bullets" +
                          " ORDER BY project_id, seq IS NULL, seq, rowid"),
    technologies: rows<Named>("SELECT rowid AS rowid, project_id, technology FROM project_technologies" +
                              " ORDER BY project_id, technology"),
    metrics: rows<Named>("SELECT rowid AS rowid, project_id, metric FROM project_metrics" +
                         " ORDER BY project_id, rowid"),
    links: rows<Link>("SELECT rowid AS rowid, project_id, label, url FROM project_links" +
                      " ORDER BY project_id, rowid"),
  };
  for (const project of projects)
    for (const [name, found] of Object.entries(children))
      Object.assign(project, { [name]: found.filter((r) => r.project_id === project.rowid) });
  for (const employer of employers)
    employer.projects = projects.filter((p) => p.employer_id === employer.rowid);
  return employers;
}

export type Prospect = {
  posting: Row;
  events: Row[];
  staged: Row | null;
  fields: Row[];
  aliases: string[];
};

export function prospect(key: string): Prospect | null {
  const found = one("SELECT * FROM prospects WHERE key=?", [key]);
  if (!found) return null;
  return {
    posting: found,
    events: rows("SELECT at, status, note FROM events WHERE key=? ORDER BY id", [key]),
    staged: one("SELECT url, ats, screenshot, status, blocked_on FROM staged WHERE key=?", [key]),
    fields: rows("SELECT label, value, tier, flag FROM staged_fields WHERE key=? ORDER BY rowid", [key]),
    aliases: rows<{ key: string }>("SELECT key FROM postings WHERE canonical_key=?", [key])
      .map((r) => r.key),
  };
}

export const vocabularies = () => ({
  section: vocabulary("profile", "section"),
  kind: vocabulary("search_criteria", "kind"),
  status: vocabulary("projects", "status"),
});
