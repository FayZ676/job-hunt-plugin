import fs from "node:fs";
import { z } from "zod";

import { absolute, companions, db, one, rows } from "./core/db.ts";
import { TABLES } from "./core/schema.ts";

export const Doomed = TABLES.postings.pick({
  key: true,
  company: true,
  title: true,
  disposition: true,
  status: true,
  posted_at: true,
  last_fetched: true,
  resume: true,
});

export type Doomed = z.infer<typeof Doomed>;

export type Reckoning = {
  postings: Doomed[];
  duplicates: number;
  events: number;
  staged: number;
  files: string[];
};

export type Purged = Reckoning & {
  deleted: string[];
  stubborn: string[];
};

const COLUMNS = Object.keys(Doomed.shape).join(",");

const counted = (sql: string, keys: string[]) =>
  one(z.object({ n: z.number() }), sql.replace("?keys", keys.map(() => "?").join(",")), keys)!.n;

function selected(where: string): string[] {
  const clause = where.trim();
  if (!clause) throw new Error("say what to remove: --where <SQL over postings>");
  try {
    return rows(TABLES.postings.pick({ key: true }), `SELECT key FROM postings WHERE ${clause}`).map((row) => row.key);
  } catch (error) {
    throw new Error(`--where is not a condition postings understands: ${(error as Error).message}`);
  }
}

export function reckon(where: string): Reckoning {
  const matched = selected(where);
  if (!matched.length) return { postings: [], duplicates: 0, events: 0, staged: 0, files: [] };

  const held = new Set(matched);
  for (const row of rows(
    TABLES.postings.pick({ key: true }),
    `SELECT key FROM postings WHERE canonical_key IN (${matched.map(() => "?").join(",")})`,
    matched,
  ))
    held.add(row.key);

  const keys = [...held];
  const postings = rows(
    Doomed,
    `SELECT ${COLUMNS} FROM postings WHERE key IN (${keys.map(() => "?").join(",")})`,
    keys,
  );

  return {
    postings,
    duplicates: keys.length - matched.length,
    events: counted("SELECT COUNT(*) n FROM events WHERE key IN (?keys)", keys),
    staged: counted("SELECT COUNT(*) n FROM staged WHERE key IN (?keys)", keys),
    files: postings.filter((row) => row.resume).flatMap((row) => companions(absolute(row.resume as string))),
  };
}

export function purge(where: string): Purged {
  const reckoning = reckon(where);
  if (!reckoning.postings.length) return { ...reckoning, deleted: [], stubborn: [] };

  db().transaction(() => {
    const remove = db().prepare("DELETE FROM postings WHERE key=?");
    for (const row of reckoning.postings) remove.run(row.key);
  })();

  const deleted: string[] = [];
  const stubborn: string[] = [];
  for (const held of reckoning.files) {
    try {
      fs.unlinkSync(held);
    } catch {
      /* already gone, or coming back */
    }
    (fs.existsSync(held) ? stubborn : deleted).push(held);
  }
  return { ...reckoning, deleted, stubborn };
}
