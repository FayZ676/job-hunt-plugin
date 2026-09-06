import type { Aim, Board, Fetcher } from "../contract.ts";
import { get, maybe, pool, soft } from "../net.ts";
import { REMOTE, fromUrl, said } from "../shape.ts";
import { posting } from "../../posting.ts";
import { toIso } from "../../text.ts";

const API = "https://api.smartrecruiters.com/v1/companies";
const PAGE = 100;
const PAGES = 20;
const HYDRATE = 8;

type Job = {
  id: string;
  name: string;
  releasedDate?: string;
  company?: { name?: string };
  location?: { city?: string; region?: string; country?: string; remote?: boolean; fullLocation?: string };
};

type Detail = { applyUrl?: string; postingUrl?: string; jobAd?: { sections?: Record<string, { text?: string }> } };

const where = (job: Job) =>
  job.location?.fullLocation ??
  [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(", ");

async function listing(board: string, query: string) {
  const held: Job[] = [];
  for (let page = 0; page < PAGES; page += 1) {
    const asked = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
    if (query) asked.set("q", query);
    const found = (await get(`${API}/${board}/postings?${asked}`)) as { content?: Job[]; totalFound?: number };
    const batch = found.content ?? [];
    held.push(...batch);
    if (batch.length < PAGE) break;
  }
  return held;
}

const smartrecruiters: Fetcher = {
  id: "smartrecruiters",
  takes: "the company identifier in a jobs.smartrecruiters.com URL — capitalized, sometimes suffixed with a digit",

  candidate(held) {
    return fromUrl(held, /smartrecruiters\.com$/, /^\/([^/]+)/) ?? (/^[A-Za-z0-9-]{2,64}$/.test(held) ? held : null);
  },

  async probe(held) {
    const found = await maybe(
      () => get(`${API}/${held}/postings?limit=1`) as Promise<{ totalFound?: number; content?: Job[] }>,
    );
    if (!found?.totalFound) return null;
    return { board: held, name: found.content?.[0]?.company?.name || held };
  },

  async openings(from: Board, aim: Aim) {
    const queries = aim.terms.length ? aim.terms : [""];
    const seen = new Map<string, Job>();
    for (const query of queries) for (const job of await listing(from.board, query)) seen.set(job.id, job);

    const wanted = [...seen.values()].slice(0, aim.max ?? seen.size);
    const details = await pool(wanted, HYDRATE, (job) =>
      soft(() => get(`${API}/${from.board}/postings/${job.id}`) as Promise<Detail>),
    );

    return wanted.map((job, at) => {
      const detail = details[at];
      const sections = detail?.jobAd?.sections ?? {};
      const body = ["jobDescription", "qualifications", "additionalInformation"]
        .map((name) => sections[name]?.text)
        .filter(Boolean)
        .join("\n\n");
      const location = where(job);
      return posting({
        key: `smartrecruiters:${job.id}`,
        source: "smartrecruiters",
        company: job.company?.name || from.name,
        title: job.name,
        url: detail?.postingUrl ?? detail?.applyUrl,
        location,
        remote: Boolean(job.location?.remote) || REMOTE.test(location),
        posted_at: toIso(job.releasedDate),
        description: said(body),
        raw: JSON.stringify(job),
      });
    });
  },
};

export default smartrecruiters;
