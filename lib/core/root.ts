import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const holds = (dir: string) => fs.existsSync(path.join(dir, "sql", "logic.sql"));

const upward = (from: string) => {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    if (holds(dir)) return dir;
    if (dir === path.dirname(dir)) return null;
  }
};

export const ROOT =
  [path.dirname(fileURLToPath(import.meta.url)), process.cwd()].map(upward).find(Boolean) ?? process.cwd();

const ENV_FILE = path.join(ROOT, ".env.local");
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
