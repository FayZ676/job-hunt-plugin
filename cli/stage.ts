#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

import { ddl, open } from "../lib/db.ts";
import { vocabulary } from "../lib/schema.ts";
import { printRows } from "../lib/table.ts";
import { fail, guard } from "./kit.ts";

const CLOSED = ["applied", "rejected", "closed"];
const TIERS = () => [...vocabulary(ddl(), "staged_fields", "tier")].sort();

const absolute = (held: string) =>
  path.resolve(held.replace(/^~(?=$|\/)/, os.homedir()));

type Field = { label: string; value: string; tier: string; flag: string | null };

function parseField(raw: string): Field {
  const parts = raw.split("|");
  if (parts.length < 3)
    fail(`--field wants 'label|value|tier' or 'label|value|tier|flag', got '${raw}'`);
  const [label, value, tier] = parts.slice(0, 3).map((part) => part.trim());
  const flag = parts.length > 3 && parts[3].trim() ? parts[3].trim() : null;
  if (!TIERS().includes(tier))
    fail(`tier must be one of ${TIERS().join(", ")}, got '${tier}' on '${label}'`);
  if (!label) fail(`a field needs a label: '${raw}'`);
  return { label, value, tier, flag };
}

const collect = (value: string, held: string[]) => [...held, value];

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
  .option("--field <label|value|tier[|flag]>", "", collect, [])
  .option("--blocked-on <what>", "what is missing, when the block is not an empty field")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const database = open(options.db);
    const row = database.prepare(
      "SELECT key, company, title, status, resume FROM prospects WHERE key=?")
      .get(key) as { status: string; resume: string | null } | undefined;
    if (!row) fail(`no prospect '${key}'`);
    if (CLOSED.includes(row.status)) fail(`${key} is already ${row.status} — nothing to stage`);
    if (!row.resume)
      fail(`${key} has no resume — build it first: job-resume build <spec> --key ${key}`);
    if (!fs.existsSync(absolute(row.resume)))
      fail(`the resume recorded for ${key} is not on disk: ${row.resume}`);

    const screenshot = absolute(options.screenshot);
    if (!fs.existsSync(screenshot))
      fail(`no screenshot at ${screenshot} — Phase 4 ends with the filled form captured`);

    if (!options.field.length)
      fail("stage at least one --field: an application with no recorded answers is not staged");
    const fields = options.field.map(parseField);

    const empty = fields.filter((field: Field) => !field.value).map((field: Field) => field.label);
    const blockedOn =
      options.blockedOn || (empty.length ? `no answer for: ${empty.join("; ")}` : null);
    const status = blockedOn ? "blocked" : "ready";

    database.transaction(() => {
      database.prepare(
        "INSERT INTO staged(key,url,screenshot,status,blocked_on) VALUES(?,?,?,?,?) " +
        "ON CONFLICT(key) DO UPDATE SET url=excluded.url," +
        "  screenshot=excluded.screenshot, status=excluded.status, blocked_on=excluded.blocked_on")
        .run(key, options.url, screenshot, status, blockedOn);
      database.prepare("DELETE FROM staged_fields WHERE key=?").run(key);
      const insert = database.prepare(
        "INSERT INTO staged_fields(key,label,value,tier,flag) VALUES(?,?,?,?,?)");
      for (const field of fields)
        insert.run(key, field.label, field.value || null, field.tier, field.flag);
      database.prepare("UPDATE postings SET status='staged' WHERE key=?").run(key);
    })();

    const flagged = fields.filter((field: Field) => field.flag).map((field: Field) => field.label);
    console.log(`${key}  ${status}  ${fields.length} fields`);
    if (blockedOn) console.log(`  blocked_on: ${blockedOn}`);
    if (flagged.length) console.log(`  flagged for review: ${flagged.join("; ")}`);
  }));

program
  .command("show")
  .description("every field staged for one application")
  .argument("<key>")
  .option("--json")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const database = open(options.db);
    const row = database.prepare(
      "SELECT s.key, p.company, p.title, s.url, s.status, s.blocked_on, s.screenshot," +
      "       p.resume FROM staged s JOIN prospects p ON p.key=s.key WHERE s.key=?")
      .get(key) as any;
    if (!row) fail(`nothing staged for '${key}'`);
    console.log(`${row.company} — ${row.title}  [${row.key}]  ${row.status}`);
    if (row.blocked_on) console.log(`  blocked_on: ${row.blocked_on}`);
    console.log(`  ${row.url || ""}`);
    console.log(`  resume     ${row.resume}`);
    console.log(`  screenshot ${row.screenshot}\n`);
    printRows(database.prepare(
      "SELECT tier, label, value, flag FROM staged_fields WHERE key=? ORDER BY rowid")
      .all(key) as Record<string, unknown>[], options.json);
  }));

program
  .command("list")
  .description("everything staged, and what each is blocked on")
  .option("--json")
  .option("--db <path>")
  .action(guard((options) => {
    printRows(open(options.db).prepare(
      "SELECT s.key, p.company, p.title, p.score, s.status, p.status AS prospect, " +
      "       s.blocked_on FROM staged s JOIN prospects p ON p.key=s.key " +
      "ORDER BY s.status, p.score DESC").all() as Record<string, unknown>[], options.json);
  }));

program
  .command("drop")
  .description("unstage, back to shortlisted")
  .argument("<key>")
  .option("--db <path>")
  .action(guard((key: string, options) => {
    const database = open(options.db);
    if (!database.prepare("SELECT 1 FROM staged WHERE key=?").get(key))
      fail(`nothing staged for '${key}'`);
    database.transaction(() => {
      database.prepare("DELETE FROM staged_fields WHERE key=?").run(key);
      database.prepare("DELETE FROM staged WHERE key=?").run(key);
      database.prepare(
        "UPDATE postings SET status='shortlisted' WHERE key=? AND status='staged'").run(key);
    })();
    console.log(`${key} unstaged`);
  }));

program.parseAsync();
