import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { db, one } from "./core/db.ts";
import { ROOT } from "./core/root.ts";
import { VIEWS } from "./core/schema.ts";
import { DENSITY, FONTS, build as markup, type Density } from "./core/typst.ts";

const FONT_DIR = path.join(ROOT, "assets", "fonts");

function resolved(family: string) {
  const listed = spawnSync("typst", ["fonts", "--font-path", FONT_DIR], { encoding: "utf8" });
  return listed.stdout.split("\n").includes(family);
}

export type Built = { out: string; density: Density; recorded: string | null };

const stem = (held: string) => held.slice(0, held.length - path.extname(held).length);

export function build(
  specPath: string,
  outPath: string | undefined,
  options: { density: string; keepTyp?: boolean; key?: string },
): Built {
  if (spawnSync("which", ["typst"], { stdio: "ignore" }).status !== 0)
    throw new Error("typst not found: brew install typst");

  const density = options.density as Density;
  if (!(density in DENSITY))
    throw new Error(`--density must be one of ${Object.keys(DENSITY).join(", ")}, got '${density}'`);

  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const font = spec.font ?? FONTS.body;
  if (!resolved(font))
    throw new Error(
      `font '${font}' is not installed, and typst would silently substitute one with different ` +
        `metrics — the page would reflow. Install it, or drop "font" from the spec to use ${FONTS.body}.`,
    );
  const out = path.resolve(outPath || `${stem(specPath)}.pdf`);
  const source = options.keepTyp
    ? `${stem(out)}.typ`
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), "job-resume-")), "resume.typ");
  fs.writeFileSync(source, markup(spec, density), "utf8");

  try {
    const ran = spawnSync("typst", ["compile", "--font-path", FONT_DIR, source, out], {
      encoding: "utf8",
    });
    if (ran.status) throw new Error(`typst failed:\n${ran.stderr}`);
  } finally {
    if (!options.keepTyp) fs.rmSync(path.dirname(source), { recursive: true, force: true });
  }
  if (!fs.existsSync(out)) throw new Error(`typst reported success but ${out} is not there`);

  if (!options.key) return { out, density, recorded: null };

  const row = one(VIEWS.prospects.pick({ status: true }), "SELECT status FROM prospects WHERE key=?", [options.key]);
  if (!row) throw new Error(`no prospect '${options.key}' — the PDF is at ${out}, unrecorded`);
  db().prepare("UPDATE postings SET resume=? WHERE key=?").run(out, options.key);
  return { out, density, recorded: row.status };
}
