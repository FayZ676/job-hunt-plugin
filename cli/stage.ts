#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { Command } from "commander";

import { open } from "../lib/core/db.ts";
import { printRows } from "../lib/core/table.ts";
import { TIERS, add, drop, list, show, type Field } from "../lib/stage.ts";
import { collect, fail, guard } from "./kit.ts";

function parseField(raw: string): Field {
  const parts = raw.split("|");
  if (parts.length < 3)
    fail(`--field wants 'label|value|tier' or 'label|value|tier|flag', got '${raw}'`);
  const [label, value, tier] = parts.slice(0, 3).map((part) => part.trim());
  return {
    label,
    value,
    tier,
    flag: parts.length > 3 && parts[3].trim() ? parts[3].trim() : null,
  };
}

const program = new Command("job-stage").description(
  `Phase 4 — fill the form, record it, and stop with a finger over the button.

  job-stage add KEY --url URL --screenshot shot.png
      --field 'Legal right to work without sponsorship?|Yes|policy'
      --field 'Tell us about an AI product you built|…|judgment|needs-review'
  job-stage show KEY                     every field staged for one application
  job-stage list                         everything staged, and what each is blocked on
  job-stage drop KEY                     unstage, back to shortlisted

\`ready\` and \`blocked\` are derived, never asserted: a field staged with no value
blocks the application and names itself in blocked_on.`);

program
  .command("add")
  .description("record a filled form; status is derived from the fields")
  .argument("<key>")
  .requiredOption("--url <url>", "the apply URL the form was filled at")
  .requiredOption("--screenshot <path>", "the completed form, captured")
  .option("--field <label|value|tier[|flag]>", `tier is one of ${TIERS().join(", ")}`, collect, [])
  .option("--blocked-on <what>", "what is missing, when the block is not an empty field")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const staged = add(open(options.db), key, {
      url: options.url,
      screenshot: options.screenshot,
      fields: options.field.map(parseField),
      blockedOn: options.blockedOn,
    });
    console.log(`${key}  ${staged.status}  ${staged.fields} fields`);
    if (staged.blockedOn) console.log(`  blocked_on: ${staged.blockedOn}`);
    if (staged.flagged.length)
      console.log(`  flagged for review: ${staged.flagged.join("; ")}`);
  }));

program
  .command("show")
  .description("every field staged for one application")
  .argument("<key>")
  .option("--json")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const { application, fields } = show(open(options.db), key);
    console.log(
      `${application.company} — ${application.title}  [${application.key}]  ${application.status}`);
    if (application.blocked_on) console.log(`  blocked_on: ${application.blocked_on}`);
    console.log(`  ${application.url || ""}`);
    console.log(`  resume     ${application.resume}`);
    console.log(`  screenshot ${application.screenshot}\n`);
    printRows(fields, options.json);
  }));

program
  .command("list")
  .description("everything staged, and what each is blocked on")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    printRows(list(open(options.db)), options.json);
  }));

program
  .command("drop")
  .description("unstage, back to shortlisted")
  .argument("<key>")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    drop(open(options.db), key);
    console.log(`${key} unstaged`);
  }));

program.parseAsync();
