import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: import.meta.dirname,
  outputFileTracingIncludes: { "/**": ["sql/*.sql"] },
};

export default nextConfig;
