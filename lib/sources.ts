import fs from "node:fs";

import { MAX_DESCRIPTION_CHARS, htmlToText, toIso } from "./text.ts";
import { posting, type Posting } from "./posting.ts";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) job-scan/1.0";
const VIEWJOB = "https://www.indeed.com/viewjob?jk=";
const APPLYSTART = "https://www.indeed.com/applystart?jk=";

export type Company = { name: string; ats: string; slug: string };
type Json = Record<string, any>;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export async function getJson(url: string, timeout = 25000, attempts = 3): Promise<any> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const answered = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeout),
      });
      if (!answered.ok) throw new Error(`HTTP ${answered.status} ${answered.statusText}`);
      return await answered.json();
    } catch (error) {
      last = error;
      if (attempt < attempts - 1) await sleep(1500 * (attempt + 1));
    }
  }
  throw last;
}

export const ENDPOINT: Record<string, string> = {
  greenhouse: "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
  lever: "https://api.lever.co/v0/postings/{slug}?mode=json",
  ashby: "https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true",
  indeed: "browser harvest, loaded from a file -- no endpoint",
};

export const QUIRK: Record<string, string> = {
  greenhouse:
    "`content` is HTML-escaped HTML, unescaped twice here. Without ?content=true there are no " +
    "descriptions to score on",
  lever:
    "returns a BARE ARRAY; createdAt is epoch ms; a posting splits across descriptionPlain, " +
    "`lists` and `additional`. A live board with no postings returns [] at 200, a wrong slug 404s",
  ashby:
    "best payload: descriptionPlain needs no HTML handling, isRemote is a real boolean, " +
    "compensation bands come back. isListed:false normalizes to expired",
  indeed: "navigate, never fetch() -- see references/fetching.md for the harvest",
};

const clipped = (text: string) => text.slice(0, MAX_DESCRIPTION_CHARS);

async function greenhouse(company: Company): Promise<Posting[]> {
  const { slug } = company;
  const payload: Json = await getJson(ENDPOINT.greenhouse.replace("{slug}", slug));
  return (payload.jobs ?? []).map((job: Json) => {
    const location = String(job.location?.name ?? "").trim();
    return posting({
      key: `greenhouse:${slug}:${job.id}`,
      source: "greenhouse",
      ats: "greenhouse",
      company: company.name,
      title: job.title,
      url: job.absolute_url,
      apply_url: job.absolute_url,
      location,
      remote: location.toLowerCase().includes("remote"),
      posted_at: toIso(job.first_published ?? job.updated_at),
      description: clipped(htmlToText(job.content)),
    });
  });
}

const leverDescription = (job: Json) => {
  const parts = [job.descriptionPlain || htmlToText(job.description)];
  for (const section of job.lists ?? []) {
    const heading = String(section.text ?? "").trim();
    const body = htmlToText(section.content);
    if (heading) parts.push(heading);
    if (body) parts.push(body);
  }
  parts.push(job.additionalPlain || htmlToText(job.additional));
  return clipped(parts.filter(Boolean).join("\n\n"));
};

async function lever(company: Company): Promise<Posting[]> {
  const { slug } = company;
  const payload = await getJson(ENDPOINT.lever.replace("{slug}", slug));
  if (!Array.isArray(payload)) throw new Error("lever board returned no posting list");
  return payload.map((job: Json) => {
    const categories = job.categories ?? {};
    const locations: string[] = categories.allLocations ?? [];
    const location = categories.location ?? locations[0] ?? "";
    const workplace = String(job.workplaceType ?? "").toLowerCase();
    const salary = job.salaryRange ?? {};
    return posting({
      key: `lever:${slug}:${job.id}`,
      source: "lever",
      ats: "lever",
      company: company.name,
      title: job.text,
      url: job.hostedUrl,
      apply_url: job.applyUrl || job.hostedUrl,
      location: locations.length ? locations.join(", ") : String(location).trim(),
      remote: workplace === "remote" || String(location).toLowerCase().includes("remote"),
      compensation: salary.min
        ? `${salary.min}-${salary.max} ${salary.currency ?? ""}`.trim()
        : null,
      comp_min: salary.min,
      comp_max: salary.max,
      comp_period:
        salary.interval == null || salary.interval === "per-year-salary" ? "YEARLY" : null,
      posted_at: toIso(job.createdAt),
      description: leverDescription(job),
    });
  });
}

async function ashby(company: Company): Promise<Posting[]> {
  const { slug } = company;
  const payload: Json = await getJson(ENDPOINT.ashby.replace("{slug}", slug));
  return (payload.jobs ?? []).map((job: Json) => {
    const extra = (job.secondaryLocations ?? [])
      .map((held: Json) => held?.location)
      .filter(Boolean);
    const location = [job.location ?? "", ...extra].join(", ").replace(/^[,\s]+|[,\s]+$/g, "");
    const compensation = job.compensation ?? {};
    return posting({
      key: `ashby:${slug}:${job.id}`,
      source: "ashby",
      ats: "ashby",
      company: company.name,
      title: job.title,
      url: job.jobUrl,
      apply_url: job.applyUrl || job.jobUrl,
      location,
      remote: Boolean(job.isRemote) || location.toLowerCase().includes("remote"),
      compensation: compensation.compensationTierSummary ?? null,
      expired: job.isListed === false,
      posted_at: toIso(job.publishedAt),
      description: clipped(job.descriptionPlain || htmlToText(job.descriptionHtml)),
    });
  });
}

const grouped = (amount: number) =>
  Math.round(amount).toLocaleString("en-US", { maximumFractionDigits: 0 });

async function indeed(harvestPath: string): Promise<Posting[]> {
  const payload = JSON.parse(fs.readFileSync(harvestPath, "utf8"));
  let cards: Json[];
  if (Array.isArray(payload)) cards = payload;
  else {
    const blocks: Json[] = payload.results ?? [];
    cards = blocks.length
      ? blocks.flatMap((block) => block.rows ?? [])
      : (payload.rows ?? []);
  }

  return cards
    .filter((card) => card.jobkey)
    .map((card) => {
      const salary = card.extractedSalary ?? {};
      const remote = card.remoteWorkModel?.type ?? "";
      const location = card.formattedLocation ?? "";
      const low = salary.min;
      const high = salary.max;
      const unit = String(salary.type ?? "").toLowerCase();
      const stated = low || high
        ? (low && high ? `${grouped(low)}-${grouped(high)} ${unit}` : `${grouped(low || high)} ${unit}`).trim()
        : null;
      return posting({
        key: `indeed:${card.jobkey}`,
        source: "indeed",
        ats: null,
        company: card.company ?? "",
        title: card.title,
        url: VIEWJOB + card.jobkey,
        apply_url: `${APPLYSTART}${card.jobkey}&from=vj`,
        location,
        remote: Boolean(remote) || String(location).toLowerCase().includes("remote"),
        compensation: stated,
        comp_min: low,
        comp_max: high,
        comp_period: String(salary.type ?? "").toUpperCase() || null,
        sponsored: Boolean(card.sponsored),
        expired: Boolean(card.expired),
        posted_at: toIso(card.pubDate),
        raw: JSON.stringify(card),
      });
    });
}

type Entry =
  | { fetch: (company: Company) => Promise<Posting[]>; kind: "board"; rank: number }
  | { fetch: (path: string) => Promise<Posting[]>; kind: "harvest"; rank: number };

export const REGISTRY: Record<string, Entry> = {
  greenhouse: { fetch: greenhouse, kind: "board", rank: 0 },
  lever: { fetch: lever, kind: "board", rank: 0 },
  ashby: { fetch: ashby, kind: "board", rank: 0 },
  indeed: { fetch: indeed, kind: "harvest", rank: 1 },
};

const listed = (held: Record<string, unknown>) => Object.keys(held).sort().join(",");
if (listed(REGISTRY) !== listed(ENDPOINT) || listed(REGISTRY) !== listed(QUIRK))
  throw new Error("a source is missing an endpoint or a quirk");

export const BOARDS = Object.fromEntries(
  Object.entries(REGISTRY)
    .filter(([, entry]) => entry.kind === "board")
    .map(([name, entry]) => [name, entry.fetch as (company: Company) => Promise<Posting[]>]),
);

const RANK = Object.fromEntries(Object.entries(REGISTRY).map(([name, e]) => [name, e.rank]));

export const rank = (source: string | null | undefined) => RANK[source ?? ""] ?? 99;

export function describe() {
  const entries = Object.entries(REGISTRY).sort(
    ([a, one], [b, two]) => one.rank - two.rank || a.localeCompare(b),
  );
  for (const [name, entry] of entries) {
    console.log(`${name}  [${entry.kind}, rank ${entry.rank}]`);
    console.log(`  ${ENDPOINT[name]}`);
    console.log(`  ${QUIRK[name]}\n`);
  }
}
