#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { PATHS } from "../lib/core/db.ts";

const asked = process.argv.slice(2);
if (asked.includes("--help")) {
  console.log(`Usage: job-paths [${Object.keys(PATHS).join("|")}]

Print an absolute path the skill owns. Defaults to career.`);
  process.exit(0);
}

const requested = asked.length ? asked : ["career"];
const unknown = requested.find((name) => !(name in PATHS));
if (unknown) {
  console.error(`unknown path '${unknown}'; choose from ${Object.keys(PATHS).join(", ")}`);
  process.exit(1);
}
for (const name of requested) console.log(PATHS[name as keyof typeof PATHS]);
