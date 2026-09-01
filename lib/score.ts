import type { Database } from "better-sqlite3";

type Standing = {
  location: string | null;
  remote_preference: string | null;
  willing_to_relocate: number | null;
  employment_type: string | null;
  compensation_floor: number | null;
  compensation_currency: string | null;
  requires_sponsorship_now_or_future: number | null;
  legal_right_to_work_without_sponsorship: number | null;
};

export type Prospect = {
  key: string; company: string; title: string; location: string | null; remote: number | null;
  compensation: string | null; posted_at: string | null; url: string | null;
  score: number | null; status: string | null; description: string | null;
};

const said = (value: string) => value.replace(/_/g, " ");

const facts = (row: Standing | undefined) => [
  row?.location && `Based in ${row.location}.`,
  row?.remote_preference && `Wants ${said(row.remote_preference)} work.`,
  row?.willing_to_relocate === 0 && "Will not relocate for a role.",
  row?.willing_to_relocate === 1 && "Open to relocating.",
  row?.employment_type && `Wants ${said(row.employment_type)} roles.`,
  row?.compensation_floor
    && `Will not go below ${row.compensation_floor} ${row.compensation_currency ?? ""}.`.trim(),
  row?.requires_sponsorship_now_or_future === 0
    && row?.legal_right_to_work_without_sponsorship === 1
    && "Needs no visa sponsorship, now or later.",
].filter((line): line is string => Boolean(line));

export function instructions(database: Database) {
  const standing = facts(
    database.prepare("SELECT * FROM identity WHERE id=1").get() as Standing | undefined);
  const written = database
    .prepare("SELECT text FROM instructions WHERE id=1")
    .get() as { text: string | null } | undefined;
  return { standing, text: written?.text ?? null };
}

export const triage = (database: Database, filter: { status?: string; limit?: number } = {}) =>
  database.prepare(
    "SELECT * FROM triage" + (filter.status ? " WHERE status=?" : "") +
    (filter.limit ? ` LIMIT ${Number(filter.limit)}` : ""),
  ).all(...(filter.status ? [filter.status] : [])) as Record<string, unknown>[];

export const prospect = (database: Database, key: string) =>
  database.prepare(
    "SELECT key, company, title, location, remote, compensation, posted_at, url, " +
    "score, status, description FROM prospects WHERE key=?").get(key) as Prospect | undefined;

export const unscored = (database: Database) =>
  database.prepare(
    "SELECT key, company, title, location, first_seen FROM prospects " +
    "WHERE score IS NULL ORDER BY first_seen DESC").all() as Record<string, unknown>[];

export function record(database: Database, key: string, score: number, reason: string) {
  const row = prospect(database, key);
  if (!row) throw new Error(`no prospect '${key}'`);
  if (!(score >= 0 && score <= 10)) throw new Error(`score must be 0-10, got ${score}`);
  if (!reason.trim())
    throw new Error("a reason cannot be empty: name the JD language that drove the score");
  if (!(row.description ?? "").trim())
    throw new Error(`${key} has no description — scoring off a title is what this phase exists ` +
      "to prevent. Search again: every source now carries its description");

  database.prepare("UPDATE postings SET score=?, reason=? WHERE key=?")
    .run(score, reason.trim(), key);
  return database.prepare("SELECT score, status FROM prospects WHERE key=?")
    .get(key) as { score: number; status: string };
}
