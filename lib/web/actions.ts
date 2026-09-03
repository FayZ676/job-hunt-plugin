import fs from "node:fs";
import path from "node:path";

import { ROOT } from "../core/root.ts";

export type Action = { id: string; does: string };

const COMMAND = /^ {2}(\S.*?) {2,}(\S.*)$/;
const ELSEWHERE = new Set(["ui", "help"]);

export const asked = (id: string, argument: string) =>
  `/job${id === "all" ? "" : ` ${id}`}${argument ? ` ${argument}` : ""}`;

const named = (call: string) => (call === "(none)" ? "all" : call.split(/\s+/)[0]);

export function actions(): Action[] {
  const lines = fs.readFileSync(path.join(ROOT, "cli", "help.txt"), "utf8").split("\n");

  const found: Action[] = [];
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
    const id = named(held[1].trim());
    if (!ELSEWHERE.has(id)) found.push({ id, does: held[2].trim() });
  }

  return found;
}
