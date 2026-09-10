import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { CAREER, DOWNLOADS } from "./db.ts";

export const PORT = Number(process.env.JOB_BROWSER_PORT) || 9222;
export const ENDPOINT = `http://127.0.0.1:${PORT}`;
export const PROFILE = path.join(CAREER, "browser");

const CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
];

const executable = () => {
  const named = process.env.JOB_BROWSER_PATH;
  if (named) {
    if (!fs.existsSync(named)) throw new Error(`JOB_BROWSER_PATH names nothing that exists: ${named}`);
    return named;
  }
  const found = CANDIDATES.find((held) => fs.existsSync(held));
  if (!found) throw new Error("no Chrome, Chromium or Edge found; set JOB_BROWSER_PATH to the executable");
  return found;
};

const settled = () => {
  const at = path.join(PROFILE, "Default", "Preferences");
  fs.mkdirSync(path.dirname(at), { recursive: true });
  let held: Record<string, any> = {};
  try {
    held = JSON.parse(fs.readFileSync(at, "utf8"));
  } catch {}
  held.download = { ...held.download, default_directory: DOWNLOADS, prompt_for_download: false };
  held.savefile = { ...held.savefile, default_directory: DOWNLOADS };
  fs.writeFileSync(at, JSON.stringify(held));
};

export async function running(): Promise<string | null> {
  try {
    const answered = await fetch(`${ENDPOINT}/json/version`, { signal: AbortSignal.timeout(1000) });
    if (!answered.ok) return null;
    const said = (await answered.json()) as { Browser?: string };
    return said.Browser ?? "a browser";
  } catch {
    return null;
  }
}

export async function ensure(): Promise<{ browser: string; started: boolean }> {
  const already = await running();
  if (already) return { browser: already, started: false };

  fs.mkdirSync(DOWNLOADS, { recursive: true });
  settled();
  const child = spawn(
    executable(),
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { detached: true, stdio: "ignore" },
  );
  child.unref();

  const until = Date.now() + 20000;
  while (Date.now() < until) {
    const up = await running();
    if (up) return { browser: up, started: true };
    await new Promise((wake) => setTimeout(wake, 250));
  }
  throw new Error(`browser never answered on ${ENDPOINT}; is another Chrome already using ${PROFILE}?`);
}
