import type { Fetcher } from "../contract.ts";
import { get, maybe } from "../net.ts";
import { REMOTE, fromUrl, said, slug, titled, wrote } from "../shape.ts";
import { posting } from "../../posting.ts";
import { toIso } from "../../text.ts";

const API = "https://api.lever.co/v0/postings";

type Job = {
  id: string;
  text: string;
  createdAt?: number;
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

const INTERVAL: Record<string, string> = {
  "per-year-salary": "YEARLY",
  "per-month-salary": "MONTHLY",
  "per-week-salary": "WEEKLY",
  "per-day-salary": "DAILY",
  "per-hour-wage": "HOURLY",
};

function pay(job: Job) {
  const band = job.salaryRange;
  if (!band || (band.min == null && band.max == null)) return {};
  const range =
    band.min != null && band.max != null && band.min !== band.max
      ? `${band.min}-${band.max}`
      : `${band.min ?? band.max}`;
  return {
    compensation: `${range} ${band.currency ?? ""}`.trim(),
    comp_min: band.min ?? null,
    comp_max: band.max ?? null,
    comp_period: INTERVAL[String(band.interval ?? "")] ?? null,
  };
}

const lever: Fetcher = {
  id: "lever",
  takes: "the board name in a jobs.lever.co URL",

  candidate(held) {
    return fromUrl(held, /lever\.co$/, /^\/([^/]+)/) ?? slug(held);
  },

  async probe(held) {
    const found = await maybe(() => get(`${API}/${held}?mode=json`) as Promise<Job[]>);
    if (!Array.isArray(found)) return null;
    return { board: held, name: titled(held) };
  },

  async openings(from) {
    const found = (await get(`${API}/${from.board}?mode=json`)) as Job[];
    return found.map((job) => {
      const where = (job.categories?.allLocations ?? [job.categories?.location]).filter(Boolean).join(" | ");
      const body = [job.descriptionPlain, job.additionalPlain].filter(Boolean).join("\n\n");
      return posting({
        key: `lever:${job.id}`,
        source: "lever",
        company: from.name,
        title: job.text,
        url: job.hostedUrl ?? job.applyUrl,
        location: where,
        remote: job.workplaceType === "remote" || REMOTE.test(where),
        posted_at: toIso(job.createdAt),
        description: wrote(body) ?? said(job.description),
        ...pay(job),
        raw: JSON.stringify(job),
      });
    });
  },
};

export default lever;
