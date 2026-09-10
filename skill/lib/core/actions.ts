import { STATUSES, type Status } from "./schema.ts";

export type Action = {
  id: string;
  does: string;
  argument: string;
  accepts: Status[];
};

export const ACTIONS: Action[] = [
  {
    id: "all",
    does: "Run all actions: search, score, resume, stage, submit",
    argument: "",
    accepts: [],
  },
  {
    id: "setup",
    does: "Build your profile",
    argument: "",
    accepts: [],
  },
  {
    id: "search",
    does: "Search Indeed for new job openings",
    argument: "[terms]",
    accepts: [],
  },
  {
    id: "score",
    does: "Score one or more job openings",
    argument: "[key]",
    accepts: ["new", "shortlisted", "skipped"],
  },
  {
    id: "resume",
    does: "Tailor a resume for one or more job openings",
    argument: "[JD, URL, or key]",
    accepts: ["new", "shortlisted", "skipped", "staged"],
  },
  {
    id: "apply",
    does: "Fill out a job application",
    argument: "[key or URL]",
    accepts: ["new", "shortlisted", "skipped", "staged"],
  },
  {
    id: "submit",
    does: "Submit a filled out job application",
    argument: "[key]",
    accepts: ["staged"],
  },
  {
    id: "cleanup",
    does: "Delete one or more job openings",
    argument: "<what to remove>",
    accepts: [],
  },
  {
    id: "feedback",
    does: "Change something",
    argument: "<what to change>",
    accepts: STATUSES,
  },
];

const BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));

export function requires(id: string, key: string, status: string | null | undefined) {
  const action = BY_ID.get(id);
  if (!action) throw new Error(`no such action: ${id}`);
  if (action.accepts.some((allowed) => allowed === status)) return;
  throw new Error(`${key} is ${status ?? "unranked"} — /job ${id} takes ${action.accepts.join(" or ")}`);
}
