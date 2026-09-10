import { STATUSES, type Status } from "./schema.ts";

export type Action = {
  id: string;
  does: string;
  argument: string;
  accepts: Status[];
  browses?: boolean;
  asks?: string;
  seed?: string;
};

export const ACTIONS: Action[] = [
  {
    id: "all",
    does: "Run all actions: search, score, resume, stage, submit",
    argument: "",
    accepts: [],
    browses: true,
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
    browses: true,
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
    browses: true,
  },
  {
    id: "submit",
    does: "Submit a filled out job application",
    argument: "[key]",
    accepts: ["staged"],
    browses: true,
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
    asks: "Write a message, or type / for an action",
  },
];

const BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));

export const asked = (id: string, argument: string) =>
  `/job${id === "all" ? "" : ` ${id}`}${argument ? ` ${argument}` : ""}`;

export const runnable = (id: string) => BY_ID.has(id);

export const suggested = (said: string): Action[] => {
  if (!said.startsWith("/") || said.includes("\n")) return [];
  const seek = said.trim().toLowerCase();
  return ACTIONS.filter((action) => asked(action.id, "").startsWith(seek));
};

export function commanded(said: string): { action: string; argument: string } | null {
  const parts = said.match(/^\/job(?:\s+(\S+)\s*([\s\S]*?))?\s*$/);
  if (!parts) return null;
  const [, id, argument = ""] = parts;
  if (!id) return { action: "all", argument: "" };
  return runnable(id) ? { action: id, argument } : null;
}

export const shown = (id: string, argument: string) => (BY_ID.get(id)?.asks ? argument : asked(id, argument));

export const seeded = (id: string) => BY_ID.get(id)?.seed;

export const browses = (id: string) => Boolean(BY_ID.get(id)?.browses);

export const describes = (id: string) => BY_ID.get(id)?.does ?? "";

export const offered = (status: string | null | undefined) =>
  ACTIONS.filter((action) => action.accepts.some((allowed) => allowed === status));

export function requires(id: string, key: string, status: string | null | undefined) {
  const action = BY_ID.get(id);
  if (!action) throw new Error(`no such action: ${id}`);
  if (action.accepts.some((allowed) => allowed === status)) return;
  throw new Error(`${key} is ${status ?? "unranked"} — /job ${id} takes ${action.accepts.join(" or ")}`);
}
