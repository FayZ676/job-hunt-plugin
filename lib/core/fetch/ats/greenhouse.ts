import type { Fetcher } from "../contract.ts";
import { get, maybe } from "../net.ts";
import { REMOTE, fromUrl, said, slug } from "../shape.ts";
import { posting } from "../../posting.ts";
import { toIso } from "../../text.ts";

const API = "https://boards-api.greenhouse.io/v1/boards";

type Job = {
  id: number;
  title: string;
  absolute_url: string;
  content: string;
  first_published?: string;
  updated_at?: string;
  location?: { name?: string };
  company_name?: string;
};

const board = (said: string) => get(`${API}/${said}/jobs?content=true`) as Promise<{ jobs?: Job[] }>;

const greenhouse: Fetcher = {
  id: "greenhouse",
  takes: "the board name in a job-boards.greenhouse.io URL",

  candidate(held) {
    return fromUrl(held, /greenhouse\.io$/, /^\/(?:embed\/job_board\/?)?([^/]+)/) ?? slug(held);
  },

  async probe(held) {
    const found = await maybe(() => get(`${API}/${held}`) as Promise<{ name?: string }>);
    if (!found?.name) return null;
    return { board: held, name: found.name };
  },

  async openings(from) {
    const found = (await board(from.board)).jobs ?? [];
    return found.map((job) => {
      const where = job.location?.name ?? "";
      return posting({
        key: `greenhouse:${from.board}-${job.id}`,
        source: "greenhouse",
        company: job.company_name || from.name,
        title: job.title,
        url: job.absolute_url,
        location: where,
        remote: REMOTE.test(where),
        posted_at: toIso(job.first_published ?? job.updated_at),
        description: said(job.content),
        raw: JSON.stringify(job),
      });
    });
  },
};

export default greenhouse;
