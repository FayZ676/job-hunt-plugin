import path from "node:path";

import { ROOT } from "./root.ts";
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
  indeed: "https://api.apify.com/v2/acts/misceres~indeed-scraper/run-sync-get-dataset-items",
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
  indeed:
    "a paid Apify actor, billed per listing, so `--max` is a budget and not a page size. " +
    "Descriptions arrive with the search, so there is no second pass. It never states `sponsored`, " +
    "so that filter cannot rule on an Indeed row",
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

export type Search = { query: string; location: string; country: string; max: number };

const APIFY_ACTOR = "misceres~indeed-scraper";
const APIFY_RUN = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

function apifyToken(): string {
  const held = process.env.APIFY_TOKEN?.trim();
  if (!held)
    throw new Error(
      "APIFY_TOKEN is not set. Get a token from apify.com/settings/integrations and put " +
      `APIFY_TOKEN=… in ${path.join(ROOT, ".env.local")}; job-scan boards runs without one`);
  return held;
}

const PERIOD: Record<string, string> = {
  hour: "HOURLY", day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY",
};

function statedPay(salary: string | null) {
  const said = String(salary ?? "");
  const unit = /\b(hour|day|week|month|year)/i.exec(said);
  const period = unit ? PERIOD[unit[1].toLowerCase()] : null;
  const amounts = [...said.matchAll(/([\d,]+(?:\.\d+)?)/g)]
    .map((found) => Number(found[1].replace(/,/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  if (!amounts.length) return { min: null, max: null, period };
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  if (/\bup to\b/i.test(said)) return { min: null, max: high, period };
  if (/\bfrom\b|\bstarting at\b/i.test(said)) return { min: low, max: null, period };
  return { min: low, max: high, period };
}

const SPAN: Record<string, number> = {
  hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3,
};

function postedIso(item: Json): string | null {
  const dated = toIso(item.postingDateParsed ?? item.datePublished ?? null);
  if (dated) return dated;
  const said = String(item.postedAt ?? "").toLowerCase();
  if (!said) return null;
  if (/just posted|today/.test(said)) return toIso(new Date().toISOString());
  const ago = /(\d+)\+?\s*(hour|day|week|month)/.exec(said);
  if (!ago) return null;
  return toIso(new Date(Date.now() - Number(ago[1]) * SPAN[ago[2]]).toISOString());
}

export function fromApify(items: Json[]): Posting[] {
  return items
    .filter((item) => item.id && !item.error)
    .map((item) => {
      const location = String(item.location ?? "").trim();
      const title = String(item.positionName ?? "");
      const pay = statedPay(item.salary ?? null);
      const written = String(item.description ?? "").trim()
        || htmlToText(String(item.descriptionHTML ?? ""));
      return posting({
        key: `indeed:${item.id}`,
        source: "indeed",
        ats: null,
        company: item.company ?? "",
        title,
        url: item.url ?? VIEWJOB + item.id,
        apply_url: item.externalApplyLink ?? `${APPLYSTART}${item.id}&from=vj`,
        location,
        remote: /remote/i.test(location) || /remote/i.test(title),
        compensation: item.salary ?? null,
        comp_min: pay.min,
        comp_max: pay.max,
        comp_period: pay.period,
        expired: Boolean(item.isExpired),
        posted_at: postedIso(item),
        description: written ? clipped(written) : null,
        raw: JSON.stringify(item),
      });
    });
}

async function indeed(search: Search): Promise<Posting[]> {
  const token = apifyToken();
  const answered = await fetch(APIFY_RUN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      position: search.query,
      location: search.location,
      country: search.country,
      maxItemsPerSearch: search.max,
      parseCompanyDetails: false,
      saveOnlyUniqueItems: true,
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!answered.ok)
    throw new Error(
      `HTTP ${answered.status} ${answered.statusText}: ${(await answered.text()).slice(0, 200)}`);
  const items = await answered.json();
  return fromApify(Array.isArray(items) ? items : []);
}

type Entry =
  | { fetch: (company: Company) => Promise<Posting[]>; kind: "board"; rank: number }
  | { fetch: (search: Search) => Promise<Posting[]>; kind: "search"; rank: number };

export const REGISTRY: Record<string, Entry> = {
  greenhouse: { fetch: greenhouse, kind: "board", rank: 0 },
  lever: { fetch: lever, kind: "board", rank: 0 },
  ashby: { fetch: ashby, kind: "board", rank: 0 },
  indeed: { fetch: indeed, kind: "search", rank: 1 },
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
