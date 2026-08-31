#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { PATHS } from "../lib/core/db.ts";

const requested = process.argv.slice(2).length ? process.argv.slice(2) : ["career"];
const unknown = requested.find((name) => !(name in PATHS));
if (unknown) {
  console.error(`unknown path '${unknown}'; choose from ${Object.keys(PATHS).join(", ")}`);
  process.exit(1);
}
for (const name of requested) console.log(PATHS[name as keyof typeof PATHS]);
