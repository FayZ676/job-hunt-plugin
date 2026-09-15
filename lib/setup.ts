import { spawnSync } from "node:child_process";
import { z } from "zod";

import { rows } from "./core/db.ts";

const listed = (sql: string) => rows(z.object({ item: z.string() }), sql).map((row) => row.item);

export type Part = {
  id: string;
  title: string;
  minutes: string;
  left: () => string[];
};

export const PARTS: Part[] = [
  {
    id: "identity",
    title: "who you are",
    minutes: "about 3 minutes",
    left: () => listed("SELECT 'identity.' || field AS item FROM unanswered WHERE section = 'identity'"),
  },
  {
    id: "instructions",
    title: "what you're looking for",
    minutes: "about 5 minutes",
    left: () => listed("SELECT 'instructions.text' AS item FROM instructions WHERE text IS NULL"),
  },
  {
    id: "experience",
    title: "your experience",
    minutes: "about 15 minutes, or 3 from something already written down",
    left: () => [
      ...listed("SELECT 'no employers' AS item WHERE NOT EXISTS (SELECT 1 FROM employers)"),
      ...listed(
        "SELECT 'no projects at ' || name AS item FROM employers e " +
          "WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.employer_id = e.id)",
      ),
      ...listed(
        "SELECT 'no technologies on ' || name AS item FROM projects p " +
          "WHERE NOT EXISTS (SELECT 1 FROM project_technologies t WHERE t.project_id = p.id)",
      ),
    ],
  },
  {
    id: "dry-run",
    title: "a first search",
    minutes: "about 2 minutes",
    left: () => listed("SELECT 'no postings yet' AS item WHERE NOT EXISTS (SELECT 1 FROM postings)"),
  },
];

export const HANDOFF = `I'm building a record of my work experience to write resumes from. Using what you can see on this machine — my code, documents, notes, commit history, and anything I've told you — summarize my experience.

For each employer or independent stretch of work:
- the employer, my title, and start and end dates, as precisely as you can tell (a year is fine)
- each project I worked on: what it was, what I personally did, and what came of it
- the technologies each project used, named individually

Rules:
- Only include what the evidence shows. If you are unsure of a date, a number, or whether work was mine alone, say so rather than guessing.
- Mark each number as measured or estimated.
- Leave out anything confidential: customer names, internal codenames, unreleased products, credentials, and figures my employer would not want shared. Describe the work in general terms instead.
- Plain text, no preamble. I will paste your answer somewhere else.`;

const TOOLS = [
  { command: "typst", install: "brew install typst" },
  { command: "pdftoppm", install: "brew install poppler" },
];

export const uninstalled = () =>
  TOOLS.filter(({ command }) => spawnSync("sh", ["-c", `command -v ${command}`]).status !== 0).map(
    ({ install }) => install,
  );

export function progress() {
  const parts = PARTS.map((part) => ({ ...part, remaining: part.left() }));
  const next = parts.findIndex((part) => part.remaining.length);
  return { parts, next };
}
