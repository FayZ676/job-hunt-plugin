import fs from "node:fs";
import path from "node:path";

const holds = (dir: string) => fs.existsSync(path.join(dir, "sql", "job.sql"));

const upward = (from: string | undefined) => {
  if (typeof from !== "string") return null;
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    if (holds(dir)) return dir;
    if (dir === path.dirname(dir)) return null;
  }
};

export const ROOT =
  [import.meta.dirname, process.cwd()].map(upward).find(Boolean) ?? process.cwd();

const ENV_FILE = path.join(ROOT, ".env.local");
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
