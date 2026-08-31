#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

import { open } from "../lib/core/db.ts";
import { DEFAULT_MARGINS, DENSITY, SECTION_TYPES, build, type Density } from "../lib/core/typst.ts";
import { fail, guard } from "./kit.ts";

const SPEC_HELP = (types: string) =>
  `A resume spec is content only -- job-resume owns every formatting decision.

{
  "name": "Ada Lovelace",
  "contact": ["Denver, CO 80202", "ada@example.com",
              {"text": "linkedin.com/in/ada", "link": "https://linkedin.com/in/ada"}],
  "sections": [{"heading": "Summary", "type": "paragraph", "text": "…"}]
}

Optional top-level keys: "font" (default Calibri), "margins" (${JSON.stringify(DEFAULT_MARGINS)}, inches).
Contact entries are joined with " | "; a plain string renders as text, {text, link}
as a hyperlink. Every section is {heading, type, …}; the heading renders uppercase,
bold, with a full-width rule.

Inside any text or bullet string: **bold**, [label](url) and bare https://… become
links. Nothing else is parsed -- no italics, no literal bullet chars, no \\n (split
those into separate items).

Section types:
${types}`;

const program = new Command("job-resume").description(
  `Phase 3 — build the tailored one-page PDF, and record it on the prospect.

  job-resume spec                            the spec contract, and every section type
  job-resume build spec.json                 render to spec.pdf
  job-resume build spec.json --key KEY       render, then record the absolute path
  job-resume build spec.json out.pdf --density tight --keep-typ

Recording stores an absolute path, because a relative one breaks the next run
started somewhere else.`);

program
  .command("spec")
  .description("print the spec contract and every section type")
  .action(() => {
    const width = Math.max(...Object.keys(SECTION_TYPES).map((held) => held.length));
    const types = Object.entries(SECTION_TYPES)
      .map(([name, [payload, shape]]) =>
        `  ${name.padEnd(width)}  ${payload}\n  ${"".padEnd(width)}  renders as ${shape}`)
      .join("\n");
    console.log(SPEC_HELP(types));
  });

program
  .command("build")
  .description("render a spec to PDF with Typst")
  .argument("<spec>")
  .argument("[out]", "default: <spec>.pdf")
  .option("--key <key>", "record the PDF on this prospect")
  .option("--density <density>", `one of ${Object.keys(DENSITY).join(", ")}`, "normal")
  .option("--keep-typ", "write the .typ alongside the PDF")
  .option("--db <path>")
  .action(guard((specPath: string, outPath: string | undefined, options) => {
    if (spawnSync("which", ["typst"], { stdio: "ignore" }).status !== 0)
      fail("typst not found: brew install typst");
    const density = options.density as Density;
    if (!(density in DENSITY))
      fail(`--density must be one of ${Object.keys(DENSITY).join(", ")}, got '${density}'`);

    const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
    const out = path.resolve(
      outPath || `${specPath.slice(0, specPath.length - path.extname(specPath).length)}.pdf`);
    const markup = build(spec, density);

    const stem = out.slice(0, out.length - path.extname(out).length);
    const source = options.keepTyp
      ? `${stem}.typ`
      : path.join(fs.mkdtempSync(path.join(os.tmpdir(), "job-resume-")), "resume.typ");
    fs.writeFileSync(source, markup, "utf8");

    try {
      const ran = spawnSync("typst", ["compile", source, out], { encoding: "utf8" });
      if (ran.status) fail(`typst failed:\n${ran.stderr}`);
    } finally {
      if (!options.keepTyp) fs.rmSync(path.dirname(source), { recursive: true, force: true });
    }
    if (!fs.existsSync(out)) fail(`typst reported success but ${out} is not there`);
    console.log(`wrote ${out} (density: ${density})`);

    if (options.key) {
      const database = open(options.db);
      const row = database.prepare("SELECT key, status FROM prospects WHERE key=?")
        .get(options.key) as { status: string } | undefined;
      if (!row) fail(`no prospect '${options.key}' — the PDF is at ${out}, unrecorded`);
      database.prepare("UPDATE postings SET resume=? WHERE key=?").run(out, options.key);
      console.log(`recorded on ${options.key} (${row.status})`);
    }
  }));

program.parseAsync();
