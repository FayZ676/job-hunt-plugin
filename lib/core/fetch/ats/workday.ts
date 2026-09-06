import type { Aim, Board, Fetcher } from "../contract.ts";
import { get, maybe, post, pool, soft } from "../net.ts";
import { REMOTE, said, titled } from "../shape.ts";
import { posting } from "../../posting.ts";
import { toIso } from "../../text.ts";

const PAGE = 20;
const PAGES = 25;
const HYDRATE = 3;

type Listed = { title: string; externalPath: string; locationsText?: string; bulletFields?: string[] };
type Detail = {
  jobPostingInfo?: {
    id?: string;
    jobPostingId?: string;
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    startDate?: string;
    externalUrl?: string;
    remoteType?: string;
  };
};

const LOCALE = /^[a-z]{2}(-[A-Za-z]{2})?$/;

async function listing(base: string, query: string) {
  const held: Listed[] = [];
  for (let page = 0; page < PAGES; page += 1) {
    const found = (await post(`${base}/jobs`, {
      appliedFacets: {},
      limit: PAGE,
      offset: page * PAGE,
      searchText: query,
    })) as { jobPostings?: Listed[] };
    const batch = found.jobPostings ?? [];
    held.push(...batch);
    if (batch.length < PAGE) break;
  }
  return held;
}

const workday: Fetcher = {
  id: "workday",
  takes: "the career-site URL, as https://<tenant>.wd<n>.myworkdayjobs.com/<site>",

  candidate(held) {
    let url: URL;
    try {
      url = new URL(held);
    } catch {
      return null;
    }
    const tenant = /^([^.]+)\.wd\d+\.myworkdayjobs\.com$/.exec(url.hostname)?.[1];
    if (!tenant) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const cxs = parts.indexOf("cxs");
    const site = cxs === -1 ? parts.filter((part) => !LOCALE.test(part))[0] : parts[cxs + 2];
    if (!site) return null;
    return `https://${url.hostname}/wday/cxs/${tenant}/${site}`;
  },

  async probe(held) {
    const found = await maybe(
      () =>
        post(`${held}/jobs`, { appliedFacets: {}, limit: 1, offset: 0, searchText: "" }) as Promise<{
          total?: number;
        }>,
    );
    if (found?.total == null) return null;
    return { board: held, name: titled(/\/cxs\/([^/]+)\//.exec(held)?.[1] ?? held) };
  },

  async openings(from: Board, aim: Aim) {
    const tenant = /\/cxs\/([^/]+)\//.exec(from.board)?.[1] ?? from.board;
    const queries = aim.terms.length ? aim.terms : [""];
    const seen = new Map<string, Listed>();
    for (const query of queries) for (const job of await listing(from.board, query)) seen.set(job.externalPath, job);

    const wanted = [...seen.values()].slice(0, aim.max ?? seen.size);
    const details = await pool(wanted, HYDRATE, (job) =>
      soft(() => get(`${from.board}${job.externalPath}`) as Promise<Detail>),
    );

    return wanted.flatMap((job, at) => {
      const info = details[at]?.jobPostingInfo;
      if (!info?.externalUrl) return [];
      const location = [info.location, ...(info.additionalLocations ?? [])].filter(Boolean).join(" | ");
      return posting({
        key: `workday:${tenant}-${info.jobPostingId ?? info.id ?? job.externalPath}`,
        source: "workday",
        company: from.name,
        title: info.title ?? job.title,
        url: info.externalUrl,
        location,
        remote: REMOTE.test(`${info.remoteType ?? ""} ${location}`),
        posted_at: toIso(info.startDate),
        description: said(info.jobDescription),
        raw: JSON.stringify({ ...job, ...info, jobDescription: undefined }),
      });
    });
  },
};

export default workday;
