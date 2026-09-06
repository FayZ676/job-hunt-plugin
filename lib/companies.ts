import { db, rows as query } from "./core/db.ts";
import { fetchers } from "./core/fetch/index.ts";
import { pool } from "./core/fetch/net.ts";
import { TABLES } from "./core/schema.ts";
import type { Registered } from "./core/sources.ts";

const Company = TABLES.companies;
export type Company = ReturnType<typeof Company.parse>;

const PROBES = 8;

export const registry = (): Registered[] =>
  query(Company.pick({ ats: true, board: true, name: true }), "SELECT ats, board, name FROM companies ORDER BY name");

export const listed = () => query(Company, "SELECT * FROM companies ORDER BY name, ats");

export type Found = Registered & { openings?: number };

export async function discover(said: string): Promise<Found[]> {
  const known = await fetchers();
  const asked = known.flatMap((one) => {
    const board = one.candidate(said);
    return board ? [{ one, board }] : [];
  });
  const found = await pool(asked, PROBES, async ({ one, board }) => {
    const held = await one.probe(board);
    return held ? { ats: one.id, board: held.board, name: held.name } : null;
  });
  return found.filter((held): held is Found => held !== null);
}

export function remember(held: Registered) {
  db()
    .prepare(
      "INSERT INTO companies(ats, board, name) VALUES(?,?,?) " +
        "ON CONFLICT(ats, board) DO UPDATE SET name=excluded.name",
    )
    .run(held.ats, held.board, held.name);
}

export function forget(name: string): number {
  return db().prepare("DELETE FROM companies WHERE name=? COLLATE NOCASE OR board=? COLLATE NOCASE").run(name, name)
    .changes;
}

export const crawled = (held: Registered[]) => {
  const mark = db().prepare("UPDATE companies SET last_crawled=date('now') WHERE ats=? AND board=?");
  db().transaction(() => {
    for (const one of held) mark.run(one.ats, one.board);
  })();
};
