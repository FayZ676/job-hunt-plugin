import fs from "node:fs";
import path from "node:path";

import { ROOT } from "../core/root.ts";

export type Phase = { id: string; takes: string | null; does: string };

const COMMAND = /^ {2}(\S.*?) {2,}(\S.*)$/;
const ELSEWHERE = new Set(["ui", "help"]);

export const asked = (id: string, argument: string) =>
  `/job${id === "all" ? "" : ` ${id}`}${argument ? ` ${argument}` : ""}`;

const named = (call: string) => {
  if (call === "(none)") return { id: "all", takes: null };
  const [id, ...rest] = call.split(/\s+/);
  const takes = rest
    .join(" ")
    .replace(/^[<[]|[>\]]$/g, "")
    .trim();
  return { id, takes: takes || null };
};

export function phases(): Phase[] {
  const lines = fs.readFileSync(path.join(ROOT, "cli", "help.txt"), "utf8").split("\n");

  const found: Phase[] = [];
  let reading = false;

  for (const line of lines) {
    const heading = line.trim();
    if (heading.endsWith(":") && !heading.includes(" ")) {
      reading = heading === "commands:";
      continue;
    }
    if (!reading || !heading) continue;

    const held = COMMAND.exec(line);
    if (!held) continue;
    const { id, takes } = named(held[1].trim());
    if (!ELSEWHERE.has(id)) found.push({ id, takes, does: held[2].trim() });
  }

  return found;
}
