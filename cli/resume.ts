#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { open } from "../lib/core/db.ts";
import { DEFAULT_MARGINS, DENSITY, FONTS, SECTION_TYPES } from "../lib/core/typst.ts";
import { build, text } from "../lib/resume.ts";
import { guard, action } from "./kit.ts";

const SPEC_HELP = (types: string) =>
  `A resume spec is content only -- cli/resume.ts owns every formatting decision.

{
  "name": "Ada Lovelace",
  "contact": ["Denver, CO", "ada@example.com",
              {"text": "linkedin.com/in/ada", "link": "https://linkedin.com/in/ada"}],
  "sections": [{"heading": "Summary", "type": "paragraph", "text": "…"}]
}

Optional top-level keys: "font" (default ${FONTS.body}), "margins" (${JSON.stringify(DEFAULT_MARGINS)}, inches).
Contact entries are joined with " | "; a plain string renders as text, {text, link}
as a hyperlink. Every section is {heading, type, …}; the heading renders uppercase,
bold, with a full-width rule.

Inside any text or bullet string: **bold**, [label](url) and bare https://… become
links. Nothing else is parsed -- no italics, no literal bullet chars, no \\n (split
those into separate items).

Section types:
${types}`;

const { program } = action(
  "cli/resume.ts",
  `Build the tailored one-page PDF, and record it on the prospect.

  cli/resume.ts spec                        the spec contract, and every section
  cli/resume.ts build spec.json             render to spec.pdf
  cli/resume.ts build spec.json --key KEY   render, then record the path
  cli/resume.ts build spec.json out.pdf --density tight --keep-typ
  cli/resume.ts text out.pdf                the text a parser reads

Recording stores an absolute path, because a relative one breaks the next run
started somewhere else.`,
);

program
  .command("spec")
  .description("print the spec contract and every section type")
  .action(() => {
    const width = Math.max(...Object.keys(SECTION_TYPES).map((held) => held.length));
    const types = Object.entries(SECTION_TYPES)
      .map(
        ([name, [payload, shape]]) => `  ${name.padEnd(width)}  ${payload}\n  ${"".padEnd(width)}  renders as ${shape}`,
      )
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
  .action(
    guard(async (specPath: string, outPath: string | undefined, options) => {
      if (options.key) open(program.opts().db);
      const built = await build(specPath, outPath, {
        density: options.density,
        keepTyp: options.keepTyp,
        key: options.key,
      });
      console.log(`wrote ${built.out} (density: ${built.density})`);
      if (built.recorded !== null) console.log(`recorded on ${options.key} (${built.recorded})`);
    }),
  );

program
  .command("text")
  .description("print the PDF's text as an application tracker's parser reads it")
  .argument("<pdf>")
  .action(guard(async (pdfPath: string) => console.log(await text(pdfPath))));

program.parseAsync();
