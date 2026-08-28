import path from "node:path";
import type { NextConfig } from "next";

const SKILL = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: SKILL,
  outputFileTracingIncludes: { "/**": ["sql/*.sql", "jobhunt/help.txt"] },
};

export default nextConfig;
