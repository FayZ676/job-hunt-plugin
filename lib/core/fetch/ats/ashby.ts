import type { Fetcher } from "../contract.ts";
import { get, maybe } from "../net.ts";
import { REMOTE, fromUrl, said, slug, titled, wrote } from "../shape.ts";
import { posting } from "../../posting.ts";
import { toIso } from "../../text.ts";

const API = "https://api.ashbyhq.com/posting-api/job-board";

type Tier = {
  components?: { compensationType?: string; interval?: string; minValue?: number; maxValue?: number }[];
};

type Job = {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: { compensationTierSummary?: string; compensationTiers?: Tier[] };
};

const INTERVAL: Record<string, string> = {
  "1 YEAR": "YEARLY",
  "1 MONTH": "MONTHLY",
  "2 WEEKS": "BIWEEKLY",
  "1 WEEK": "WEEKLY",
  "1 DAY": "DAILY",
  "1 HOUR": "HOURLY",
};

function pay(job: Job) {
  const salary = job.compensation?.compensationTiers
    ?.flatMap((tier) => tier.components ?? [])
    .find((part) => part.compensationType === "Salary");
  return {
    compensation: job.compensation?.compensationTierSummary ?? null,
    comp_min: salary?.minValue ?? null,
    comp_max: salary?.maxValue ?? null,
    comp_period: INTERVAL[String(salary?.interval ?? "")] ?? null,
  };
}

const ashby: Fetcher = {
  id: "ashby",
  takes: "the board name in a jobs.ashbyhq.com URL",

  candidate(held) {
    return fromUrl(held, /ashbyhq\.com$/, /^\/(?:job-board\/)?([^/]+)/) ?? slug(held);
  },

  async probe(held) {
    const found = await maybe(() => get(`${API}/${held}`) as Promise<{ jobs?: unknown[]; organizationName?: string }>);
    if (!found?.jobs) return null;
    return { board: held, name: found.organizationName || titled(held) };
  },

  async openings(from) {
    const found = ((await get(`${API}/${from.board}?includeCompensation=true`)) as { jobs?: Job[] }).jobs ?? [];
    return found.map((job) => {
      const where = [job.location, ...(job.secondaryLocations ?? []).map((held) => held.location)]
        .filter(Boolean)
        .join(" | ");
      return posting({
        key: `ashby:${job.id}`,
        source: "ashby",
        company: from.name,
        title: job.title,
        url: job.jobUrl ?? job.applyUrl,
        location: where,
        remote: Boolean(job.isRemote) || REMOTE.test(where),
        posted_at: toIso(job.publishedAt),
        description: wrote(job.descriptionPlain) ?? said(job.descriptionHtml),
        ...pay(job),
        raw: JSON.stringify(job),
      });
    });
  },
};

export default ashby;
