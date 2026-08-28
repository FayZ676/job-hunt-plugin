import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: import.meta.dirname,
  outputFileTracingIncludes: { "/**": ["sql/*.sql", "cli/help.txt"] },
};

export default nextConfig;
