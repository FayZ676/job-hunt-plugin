import path from "node:path";
import type { NextConfig } from "next";

const beside = path.join(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["job"],
  turbopack: { root: beside },
  outputFileTracingRoot: beside,
  outputFileTracingIncludes: { "/**": ["../skill/sql/*.sql"] },
};

export default nextConfig;
