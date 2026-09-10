#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { printRows } from "../lib/core/table.ts";
import { add, drop, list, show } from "../lib/stage.ts";
import { action } from "./kit.ts";

const { program, runs } = action(
  "job-stage",
  `Fill the form, mark it staged, and stop with a finger over the button.

  job-stage add KEY --url URL
  job-stage add KEY --url URL --blocked-on "no answer for: desired salary"
  job-stage show KEY              the application waiting at one key
  job-stage list                  everything staged, and what blocks each
  job-stage drop KEY              unstage, back to shortlisted

The filled form itself stays in the browser tab; nothing about it is copied here.`,
);

program
  .command("add")
  .description("mark a filled form staged and waiting for approval")
  .argument("<key>")
  .requiredOption("--url <url>", "the apply URL the form was filled at")
  .option("--blocked-on <what>", "what is unanswered, when the form could not be completed")
  .action(
    runs((key: string, options) => {
      const staged = add(key, { url: options.url, blockedOn: options.blockedOn });
      console.log(`${key}  ${staged.status}`);
      if (staged.blockedOn) console.log(`  blocked_on: ${staged.blockedOn}`);
    }),
  );

program
  .command("show")
  .description("the application waiting at one key")
  .argument("<key>")
  .option("--json")
  .action(
    runs((key: string, options) => {
      const application = show(key);
      if (options.json) return console.log(JSON.stringify(application, null, 2));
      console.log(`${application.company} — ${application.title}  [${application.key}]  ${application.status}`);
      if (application.blocked_on) console.log(`  blocked_on: ${application.blocked_on}`);
      console.log(`  ${application.url || ""}`);
      console.log(`  resume  ${application.resume}`);
    }),
  );

program
  .command("list")
  .description("everything staged, and what each is blocked on")
  .option("--json")
  .action(
    runs((options) => {
      printRows(list(), options.json);
    }),
  );

program
  .command("drop")
  .description("unstage, back to shortlisted")
  .argument("<key>")
  .action(
    runs((key: string) => {
      drop(key);
      console.log(`${key} unstaged`);
    }),
  );

program.parseAsync();
