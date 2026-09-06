import type { Posting } from "../posting.ts";

export type Aim = {
  terms: string[];
  notTitles: string[];
  notOrganizations: string[];
  locations: string[];
  remote: boolean;
  sinceDays: number | null;
  max: number | null;
};

export type Board = {
  board: string;
  name: string;
};

export type Fetcher = {
  id: string;
  takes: string;
  candidate(said: string): string | null;
  probe(board: string): Promise<Board | null>;
  openings(board: Board, aim: Aim): Promise<Posting[]>;
};

const FUNCTIONS = ["candidate", "probe", "openings"] as const;

export function fetcher(held: unknown, from: string): Fetcher {
  const said = held as Partial<Fetcher>;
  const wrong = [
    typeof said?.id === "string" && said.id ? "" : "id: a short name, used as the posting's source",
    typeof said?.takes === "string" && said.takes ? "" : "takes: one line on what `board` looks like",
    ...FUNCTIONS.map((name) => (typeof said?.[name] === "function" ? "" : `${name}: a function`)),
  ].filter(Boolean);
  if (wrong.length) throw new Error(`${from} does not satisfy the fetcher contract — missing ${wrong.join(", ")}`);
  return said as Fetcher;
}
