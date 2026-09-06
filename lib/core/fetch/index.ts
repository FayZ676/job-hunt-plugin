import fs from "node:fs";
import path from "node:path";

import { type Fetcher, fetcher } from "./contract.ts";

const DIR = path.join(import.meta.dirname, "ats");

let held: Fetcher[] | null = null;

export async function fetchers(): Promise<Fetcher[]> {
  if (held) return held;
  const files = fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith(".ts"))
    .sort();
  const loaded = await Promise.all(
    files.map(async (name) => fetcher((await import(path.join(DIR, name))).default, `ats/${name}`)),
  );
  const seen = new Set<string>();
  for (const one of loaded) {
    if (seen.has(one.id)) throw new Error(`two fetchers in ${DIR} both call themselves ${one.id}`);
    seen.add(one.id);
  }
  return (held = loaded);
}

export type { Aim, Board, Fetcher } from "./contract.ts";
