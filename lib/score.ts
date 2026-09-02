import { z } from "zod";

import { db, one, rows } from "./core/db.ts";
import { TABLES, VIEWS } from "./core/schema.ts";

const Standing = TABLES.identity.pick({
  location: true,
  remote_preference: true,
  willing_to_relocate: true,
  employment_type: true,
  compensation_floor: true,
  compensation_currency: true,
  requires_sponsorship_now_or_future: true,
  legal_right_to_work_without_sponsorship: true,
});

const Prospect = VIEWS.prospects.pick({
  key: true,
  company: true,
  title: true,
  location: true,
  remote: true,
  compensation: true,
  posted_at: true,
  url: true,
  score: true,
  status: true,
  description: true,
});

const Pending = VIEWS.prospects.pick({
  key: true,
  company: true,
  title: true,
  location: true,
  first_seen: true,
});

const Scored = VIEWS.prospects.pick({ score: true, status: true });
const Written = TABLES.instructions;

export type Prospect = z.infer<typeof Prospect>;

const listed = <T extends z.ZodObject>(shape: T) =>
  Object.keys(shape.shape).join(", ");

const said = (value: string) => value.replace(/_/g, " ");

const facts = (row: z.infer<typeof Standing> | null) =>
  [
    row?.location && `Based in ${row.location}.`,
    row?.remote_preference && `Wants ${said(row.remote_preference)} work.`,
    row?.willing_to_relocate === 0 && "Will not relocate for a role.",
    row?.willing_to_relocate === 1 && "Open to relocating.",
    row?.employment_type && `Wants ${said(row.employment_type)} roles.`,
    row?.compensation_floor &&
      `Will not go below ${row.compensation_floor} ${row.compensation_currency ?? ""}.`.trim(),
    row?.requires_sponsorship_now_or_future === 0 &&
      row?.legal_right_to_work_without_sponsorship === 1 &&
      "Needs no visa sponsorship, now or later.",
  ].filter((line): line is string => Boolean(line));

export const instructions = () => ({
  standing: facts(
    one(Standing, `SELECT ${listed(Standing)} FROM identity WHERE id=1`),
  ),
  text: one(Written, "SELECT text FROM instructions WHERE id=1")?.text ?? null,
});

export const triage = (filter: { status?: string; limit?: number } = {}) =>
  rows(
    VIEWS.triage,
    "SELECT * FROM triage" +
      (filter.status ? " WHERE status=?" : "") +
      (filter.limit ? ` LIMIT ${Number(filter.limit)}` : ""),
    filter.status ? [filter.status] : [],
  );

export const prospect = (key: string) =>
  one(Prospect, `SELECT ${listed(Prospect)} FROM prospects WHERE key=?`, [key]);

export const unscored = () =>
  rows(
    Pending,
    `SELECT ${listed(Pending)} FROM prospects WHERE score IS NULL ORDER BY first_seen DESC`,
  );

export function record(key: string, score: number, reason: string) {
  const row = prospect(key);
  if (!row) throw new Error(`no prospect '${key}'`);
  if (!(score >= 0 && score <= 10))
    throw new Error(`score must be 0-10, got ${score}`);
  if (!reason.trim())
    throw new Error(
      "a reason cannot be empty: name the JD language that drove the score",
    );
  if (!(row.description ?? "").trim())
    throw new Error(
      `${key} has no description — scoring off a title is what this phase exists ` +
        "to prevent. Search again: every source now carries its description",
    );

  db()
    .prepare("UPDATE postings SET score=?, reason=? WHERE key=?")
    .run(score, reason.trim(), key);
  return one(Scored, `SELECT ${listed(Scored)} FROM prospects WHERE key=?`, [
    key,
  ])!;
}
