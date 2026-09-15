#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";

import { SUBMITTED } from "../lib/core/db.ts";
import { answers } from "../lib/profile.ts";
import { HANDOFF, PARTS, progress, uninstalled } from "../lib/setup.ts";
import { action } from "./kit.ts";

const { program, runs } = action(
  "cli/setup.ts",
  "Where setup stands: the line to show the user, and what the current part still needs.",
);

const total = PARTS.length;

program
  .command("start")
  .description("create the database, and the line that opens setup — run once, before the first part")
  .action(
    runs(() => {
      fs.mkdirSync(SUBMITTED, { recursive: true });
      for (const install of uninstalled()) console.log(`install: ${install}`);
      const { next } = progress();
      if (next === -1) return console.log("say: Setup is already done.");
      const opener = answers().length
        ? `Picking up where you left off — part ${next + 1} of ${total}.`
        : `Setup is ${total} short parts, and every answer saves as you go, so you can stop anytime.`;
      console.log(`say: ${opener}`);
    }),
  );

program
  .command("next")
  .description("the line that opens the current part, and what it still needs — run at every part boundary")
  .action(
    runs(() => {
      const { parts, next } = progress();
      if (next === -1) return console.log("say: Setup is done.");
      const part = parts[next];
      const finished = parts.slice(0, next).map((done) => done.title);
      const recap = finished.length ? `Done: ${finished.join(", ")}. ` : "";
      console.log(`say: ${recap}Part ${next + 1} of ${total}: ${part.title}, ${part.minutes}.`);
      console.log(`part: ${part.id}`);
      for (const item of part.remaining) console.log(`needs: ${item}`);
    }),
  );

program
  .command("prompt")
  .description("a prompt the user pastes into an LLM on another machine, to summarize the experience it can see")
  .action(() => console.log(HANDOFF));

program.parseAsync();
