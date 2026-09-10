#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { Command } from "commander";

import { ENDPOINT, PORT, PROFILE, ensure, running } from "../lib/core/browser.ts";
import { fail, guard } from "./kit.ts";

new Command("job-browser")
  .description(
    `Start the browser the skill drives, and leave it running.

  job-browser          start it if it is not up, then print its endpoint
  job-browser status   say whether it is up
  job-browser endpoint print the endpoint and nothing else

Playwright MCP attaches to this browser over CDP instead of launching its own,
so the window outlives any one conversation: a form left half-filled, a captcha
waiting on you, and the accounts you are signed into all survive between runs.

Its profile is ${PROFILE}, apart from your everyday Chrome. Closing the window loses whatever was open in it; the profile, and what you are signed into, stays.`,
  )
  .argument("[what]", "status, endpoint, or nothing to start it")
  .action(
    guard(async (what: string | undefined) => {
      if (what === "endpoint") return console.log(ENDPOINT);

      if (what === "status") {
        const up = await running();
        return console.log(up ? `${up} on ${ENDPOINT}` : `nothing on port ${PORT}`);
      }

      if (what) fail(`unknown argument '${what}'; try status or endpoint`);

      const { browser, started } = await ensure();
      console.log(`${browser} ${started ? "started" : "already running"} on ${ENDPOINT}`);
    }),
  )
  .parseAsync();
