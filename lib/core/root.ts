import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");

const ENV_FILE = path.join(ROOT, ".env.local");
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
