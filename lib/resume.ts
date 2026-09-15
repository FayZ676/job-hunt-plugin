import fs from "node:fs";
import path from "node:path";

import { NodeCompiler, type NodeError } from "@myriaddreamin/typst-ts-node-compiler";
import { extractText, getDocumentProxy } from "unpdf";

import { db, one } from "./core/db.ts";
import { ROOT } from "./core/root.ts";
import { VIEWS } from "./core/schema.ts";
import { DENSITY, FONTS, build as markup, type Density } from "./core/typst.ts";

const FONT_DIR = path.join(ROOT, "assets", "fonts");

export type Built = { out: string; density: Density; recorded: string | null };

const stem = (held: string) => held.slice(0, held.length - path.extname(held).length);

export const companions = (pdf: string) => [pdf, `${stem(pdf)}.json`, `${stem(pdf)}.typ`].filter(fs.existsSync);

const flattened = (held: string) => held.replace(/\s+/g, " ").trim();

export async function text(pdfPath: string) {
  const document = await getDocumentProxy(new Uint8Array(fs.readFileSync(pdfPath)));
  const { text: pages } = await extractText(document, { mergePages: true });
  return pages;
}

function compiled(source: string, font: string) {
  const compiler = NodeCompiler.create({ workspace: path.dirname(source), fontArgs: [{ fontPaths: [FONT_DIR] }] });
  const result = compiler.compile({ mainFileContent: source });
  const messages = (held: NodeError | null) =>
    held ? compiler.fetchDiagnostics(held).map((diagnostic) => String(diagnostic.message)) : [];

  const errors = messages(result.takeDiagnostics());
  if (errors.length || !result.result) throw new Error(`typst failed:\n${errors.join("\n")}`);

  const warnings = messages(result.takeWarnings());
  if (warnings.some((message) => message.startsWith("unknown font family")))
    throw new Error(
      `font '${font}' is not installed, and typst would silently substitute one with different ` +
        `metrics — the page would reflow. Install it, or drop "font" from the spec to use ${FONTS.body}.`,
    );
  if (warnings.length) throw new Error(`typst warned:\n${warnings.join("\n")}`);

  return compiler.pdf(result.result);
}

export async function build(
  specPath: string,
  outPath: string | undefined,
  options: { density: string; keepTyp?: boolean; key?: string },
): Promise<Built> {
  const density = options.density as Density;
  if (!(density in DENSITY))
    throw new Error(`--density must be one of ${Object.keys(DENSITY).join(", ")}, got '${density}'`);

  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const out = path.resolve(outPath || `${stem(specPath)}.pdf`);
  const source = markup(spec, density);
  if (options.keepTyp) fs.writeFileSync(`${stem(out)}.typ`, source, "utf8");

  fs.writeFileSync(out, compiled(source, spec.font ?? FONTS.body));

  const parsed = flattened(await text(out));
  const unreadable = (spec.contact ?? [])
    .map((entry: string | { text: string }) => flattened(typeof entry === "string" ? entry : entry.text))
    .filter((entry: string) => !parsed.includes(entry));
  if (unreadable.length)
    throw new Error(
      `${out} renders, but a parser reading its text cannot find: ${unreadable.join(", ")}. ` +
        `An application tracker would lose it.`,
    );

  if (!options.key) return { out, density, recorded: null };

  const row = one(VIEWS.prospects.pick({ status: true }), "SELECT status FROM prospects WHERE key=?", [options.key]);
  if (!row) throw new Error(`no prospect '${options.key}' — the PDF is at ${out}, unrecorded`);
  db().prepare("UPDATE postings SET resume=? WHERE key=?").run(out, options.key);
  return { out, density, recorded: row.status };
}
