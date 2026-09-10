import { ACTIONS as ROSTER, type Action as Declared } from "job/actions";

export type Action = Declared & { browses: boolean; asks?: string };

const BROWSES = ["all", "search", "apply", "submit"];

const ASKS: Record<string, string> = { feedback: "Write a message, or type / for an action" };

export const ACTIONS: Action[] = ROSTER.map((action) => ({
  ...action,
  browses: BROWSES.includes(action.id),
  ...(ASKS[action.id] && { asks: ASKS[action.id] }),
}));

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

export const browses = (id: string) => Boolean(BY_ID.get(id)?.browses);

export const describes = (id: string) => BY_ID.get(id)?.does ?? "";

export const offered = (status: string | null | undefined) =>
  ACTIONS.filter((action) => action.accepts.some((allowed) => allowed === status));
