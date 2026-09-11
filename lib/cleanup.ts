import { z } from "zod";

import { absolute, db, one, rows } from "./core/db.ts";
import { removeFiles } from "./core/files.ts";
import { TABLES } from "./core/schema.ts";
import { companions } from "./resume.ts";

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

function reckonKeys(matched: string[]): Reckoning {
  if (!matched.length) return { postings: [], duplicates: 0, staged: 0, files: [] };

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
    staged: counted("SELECT COUNT(*) n FROM staged WHERE key IN (?keys)", keys),
    files: postings.filter((row) => row.resume).flatMap((row) => companions(absolute(row.resume as string))),
  };
}

function purgeKeys(matched: string[]): Purged {
  const reckoning = reckonKeys(matched);
  if (!reckoning.postings.length) return { ...reckoning, deleted: [], stubborn: [] };

  db().transaction(() => {
    const remove = db().prepare("DELETE FROM postings WHERE key=?");
    for (const row of reckoning.postings) remove.run(row.key);
  })();

  return { ...reckoning, ...removeFiles(reckoning.files) };
}

export const reckon = (where: string): Reckoning => reckonKeys(selected(where));

export const purge = (where: string): Purged => purgeKeys(selected(where));

export const purgeKey = (key: string): Purged => purgeKeys([key]);
