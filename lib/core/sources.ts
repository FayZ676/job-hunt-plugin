import { type Aim, type Board, fetchers } from "./fetch/index.ts";
import { pool } from "./fetch/net.ts";
import { places } from "./places.ts";
import { type Posting } from "./posting.ts";
import { norm, normCompany } from "./text.ts";

export const SINCE = ["1h", "24h", "7d", "6m"] as const;
export type Since = (typeof SINCE)[number];

const HOURS: Record<Since, number> = { "1h": 1, "24h": 24, "7d": 168, "6m": 4392 };

const BOARDS = 6;

export type Search = {
  terms: string[];
  notTitles: string[];
  notOrganizations: string[];
  locations: string[];
  remote: boolean;
  since: Since;
  max: number | null;
};

export type Crawled = {
  postings: Posting[];
  boards: number;
  failures: { board: string; why: string }[];
};

export type Registered = Board & { ats: string };

const SHORT = 3;

const alike = (one: string, two: string) =>
  one.length <= SHORT || two.length <= SHORT ? one === two : one.includes(two) || two.includes(one);

const holds = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(norm(needle)));

function fresh(posting: Posting, hours: number) {
  if (!posting.posted_at) return true;
  const at = Date.parse(posting.posted_at);
  return Number.isNaN(at) || Date.now() - at <= hours * 3600000;
}

function wanted(posting: Posting, aim: Search) {
  const title = norm(posting.title);
  if (aim.terms.length && !holds(title, aim.terms)) return false;
  if (aim.notTitles.length && holds(title, aim.notTitles)) return false;
  if (aim.notOrganizations.length && holds(normCompany(posting.company), aim.notOrganizations)) return false;
  if (aim.remote && !posting.remote) return false;
  if (aim.locations.length) {
    const where = places(posting.location);
    const said = aim.locations.flatMap(places);
    if (!said.some((one) => where.some((held) => alike(one, held)))) return false;
  }
  return fresh(posting, HOURS[aim.since]);
}

const aimed = (aim: Search): Aim => ({
  terms: aim.terms,
  notTitles: aim.notTitles,
  notOrganizations: aim.notOrganizations,
  locations: aim.locations,
  remote: aim.remote,
  sinceDays: HOURS[aim.since] / 24,
  max: aim.max,
});

export async function crawl(registry: Registered[], aim: Search): Promise<Crawled> {
  const known = new Map((await fetchers()).map((one) => [one.id, one]));
  const unknown = registry.filter((held) => !known.has(held.ats));
  if (unknown.length) {
    const names = [...new Set(unknown.map((held) => held.ats))].join(", ");
    throw new Error(
      `companies names a fetcher that lib/core/fetch/ats does not hold: ${names}. ` +
        "Restore the module, or drop those rows with job-companies remove.",
    );
  }

  const failures: Crawled["failures"] = [];
  const found = await pool(registry, BOARDS, async (held) => {
    try {
      return await known.get(held.ats)!.openings({ board: held.board, name: held.name }, aimed(aim));
    } catch (error) {
      failures.push({
        board: `${held.ats}:${held.board}`,
        why: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  });

  const kept = found.flat().filter((posting) => wanted(posting, aim));
  return {
    postings: aim.max ? kept.slice(0, aim.max) : kept,
    boards: registry.length,
    failures,
  };
}
