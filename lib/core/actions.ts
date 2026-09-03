import { STATUSES, type Status } from "./schema.ts";

export type Action = {
  id: string;
  does: string;
  argument: string;
  accepts: Status[];
  asks?: string;
};

export const ACTIONS: Action[] = [
  {
    id: "all",
    does: "run every action in order: search, score, resume, stage, submit",
    argument: "",
    accepts: [],
  },
  {
    id: "setup",
    does: "first-run setup: create $CAREER, build the profile, set the filters",
    argument: "",
    accepts: [],
  },
  { id: "search", does: "search and rule only", argument: "", accepts: [] },
  {
    id: "score",
    does: "score the prospects already found",
    argument: "[key]",
    accepts: ["new", "scored", "shortlisted", "skipped"],
  },
  {
    id: "resume",
    does: "tailor a resume for every shortlisted role",
    argument: "[JD, URL, or key]",
    accepts: ["shortlisted", "staged"],
  },
  {
    id: "apply",
    does: "stage every shortlisted application, stopping before submit",
    argument: "[key or URL]",
    accepts: ["shortlisted", "staged"],
  },
  {
    id: "submit",
    does: "review what is staged and submit only what you name",
    argument: "[key]",
    accepts: ["staged"],
  },
  {
    id: "feedback",
    does: "take what you say is wrong and change what produced it",
    argument: "<what is wrong>",
    accepts: STATUSES,
    asks: "Write a message ...",
  },
];

const BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));

export const asked = (id: string, argument: string) =>
  `/job${id === "all" ? "" : ` ${id}`}${argument ? ` ${argument}` : ""}`;

export const runnable = (id: string) => BY_ID.has(id);

export const offered = (status: string | null | undefined) =>
  ACTIONS.filter((action) => action.accepts.some((allowed) => allowed === status));

export function requires(id: string, key: string, status: string | null | undefined) {
  const action = BY_ID.get(id);
  if (!action) throw new Error(`no such action: ${id}`);
  if (action.accepts.some((allowed) => allowed === status)) return;
  throw new Error(`${key} is ${status ?? "unranked"} — /job ${id} takes ${action.accepts.join(" or ")}`);
}
