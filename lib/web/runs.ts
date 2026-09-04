import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { runnable, seeded, shown, asked } from "@/lib/core/actions";
import { CAREER } from "@/lib/core/db";
import { ROOT } from "@/lib/core/root";
import { CLOSING, DONE, WORKING, declared, type Standing } from "@/lib/core/standing";

export type Line = { kind: "asked" | "said" | "aside" | "wrong" | "end"; body: string; note?: string };

export type Run = { id: string; action: string; title: string; argument: string; started: string; standing: string };

type Kept =
  | { kind: "opened"; action: string; title: string; started: string; argument?: string }
  | { kind: "session"; id: string }
  | Line;

const LONGEST = 8000;
const RUNS = path.join(CAREER, "runs");
const ID = /^[0-9a-fA-F-]{36}$/;

const file = (id: string) => path.join(RUNS, `${id}.jsonl`);

const spoken = (kept: Kept): kept is Line => kept.kind !== "opened" && kept.kind !== "session";

type Live = { child: ChildProcess; ended: string; hears: Set<(kept: Kept) => void> };

const memory = globalThis as { runs?: Map<string, Live> };
const live = () => (memory.runs ??= new Map<string, Live>());

function append(id: string, kept: Kept) {
  fs.mkdirSync(RUNS, { recursive: true });
  fs.appendFileSync(file(id), `${JSON.stringify(kept)}\n`);
  for (const hears of live().get(id)?.hears ?? []) hears(kept);
}

function held(id: string): Kept[] {
  if (!ID.test(id)) throw new Error("not a conversation id");
  let text: string;
  try {
    text = fs.readFileSync(file(id), "utf8");
  } catch {
    throw new Error(`no such conversation: ${id}`);
  }
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Kept);
}

const standing = (id: string, kept: Kept[]) => {
  if (live().has(id)) return WORKING;
  const ended = [...kept].reverse().find((one): one is Line => spoken(one) && one.kind === "end");
  return ended ? ended.body : "Stopped";
};

function heard(line: string): { lines: Line[]; session?: string; standing?: Standing } {
  let said: any;
  try {
    said = JSON.parse(line);
  } catch {
    return { lines: [] };
  }

  const session = typeof said.session_id === "string" ? said.session_id : undefined;
  const some = (lines: Line[], standing?: Standing) => ({ lines, session, standing });

  if (said.type === "assistant") {
    const blocks: any[] = said.message?.content ?? [];
    const spoke = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    const { body, standing } = declared(spoke);
    return some(body ? [{ kind: "said", body }] : [], standing);
  }

  if (said.type === "result") {
    const body = String(said.result ?? "").trim();
    return some(said.is_error && body ? [{ kind: "wrong", body }] : []);
  }

  if (said.type === "stderr") return some([{ kind: "aside", body: String(said.text).trim() }]);
  if (said.type === "exit" && said.code) return some([{ kind: "wrong", body: `claude exited ${said.code}` }]);
  return some([]);
}

const outermost = (env: NodeJS.ProcessEnv) =>
  Object.fromEntries(
    Object.entries(env).filter(([name]) => !name.startsWith("CLAUDE_CODE") && name !== "CLAUDECODE"),
  ) as NodeJS.ProcessEnv;

export function listing(): Run[] {
  let names: string[];
  try {
    names = fs.readdirSync(RUNS);
  } catch {
    return [];
  }

  const runs = names
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => {
      const id = name.slice(0, -".jsonl".length);
      let kept: Kept[];
      try {
        kept = held(id);
      } catch {
        return null;
      }
      const opened = kept.find((one) => one.kind === "opened");
      if (!opened) return null;
      return {
        id,
        action: opened.action,
        title: opened.title,
        argument: opened.argument ?? "",
        started: opened.started,
        standing: standing(id, kept),
      };
    })
    .filter(Boolean) as Run[];

  return runs.sort((one, two) => two.started.localeCompare(one.started));
}

export function remembered(runs: Run[]): Record<string, string> {
  const held: Record<string, string> = {};
  for (const run of runs.slice().reverse()) {
    if (!seeded(run.action)) continue;
    if (run.argument) held[run.action] = run.argument;
  }
  return held;
}

export function begin({
  action = "",
  argument = "",
  note,
  run = null,
}: {
  action?: string;
  argument?: string;
  note?: string;
  run?: string | null;
}) {
  if (argument.length > LONGEST) throw new Error(`an argument is at most ${LONGEST} characters`);

  const words = argument.trim();
  const id = run ?? randomUUID();
  const kept = run ? held(run) : [];
  const opened = kept.find((one) => one.kind === "opened");
  const named = opened?.action ?? action;

  if (!runnable(named)) throw new Error(`no such action: ${named}`);
  if (run && live().has(run)) throw new Error("that conversation is still working");

  const resume = [...kept].reverse().find((one) => one.kind === "session")?.id;
  if (run && !resume) throw new Error("that conversation cannot be continued");

  const started = new Date().toISOString();
  if (!run) append(id, { kind: "opened", action: named, title: shown(named, words), started, argument: words });
  append(id, { kind: "asked", body: resume ? words : shown(named, words), note });

  const child = spawn(
    "claude",
    [
      "-p",
      resume ? words : asked(named, words),
      ...(resume ? ["--resume", resume] : []),
      "--append-system-prompt",
      CLOSING,
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
    ],
    { cwd: ROOT, env: outermost(process.env), stdio: ["ignore", "pipe", "pipe"] },
  );

  const one: Live = { child, ended: DONE, hears: new Set() };
  live().set(id, one);

  let rest = "";
  let seen = resume;
  child.stdout.on("data", (chunk: Buffer) => {
    rest += chunk.toString();
    const parts = rest.split("\n");
    rest = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.trim()) continue;
      const { lines, session, standing } = heard(part);
      if (standing && one.ended !== "Stopped") one.ended = standing;
      if (session && !seen) {
        seen = session;
        append(id, { kind: "session", id: session });
      }
      for (const line of lines) {
        if (line.kind === "wrong") one.ended = "Failed";
        append(id, line);
      }
    }
  });

  child.stderr.on("data", (chunk: Buffer) => append(id, { kind: "aside", body: chunk.toString().trim() }));

  child.on("error", (error) => {
    one.ended = "Failed";
    append(id, { kind: "wrong", body: error.message });
  });

  child.on("close", (code) => {
    if (code && one.ended !== "Stopped") {
      one.ended = "Failed";
      append(id, { kind: "wrong", body: `claude exited ${code}` });
    }
    append(id, { kind: "end", body: one.ended });
    live().delete(id);
  });

  return id;
}

export function erase(id: string) {
  if (!ID.test(id)) throw new Error("not a conversation id");
  if (live().has(id)) throw new Error("that conversation is still working");
  fs.rmSync(file(id), { force: true });
}

export function halt(id: string) {
  const one = live().get(id);
  if (!one) return;
  one.ended = "Stopped";
  one.child.kill("SIGTERM");
}

export function watch(id: string, signal: AbortSignal) {
  const kept = held(id);
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let open = true;
      const send = (line: Line) => {
        if (open) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      };
      const close = () => {
        if (open) controller.close();
        open = false;
        live().get(id)?.hears.delete(hears);
        signal.removeEventListener("abort", close);
      };

      const hears = (one: Kept) => {
        if (!spoken(one)) return;
        send(one);
        if (one.kind === "end") close();
      };

      for (const one of kept) if (spoken(one)) send(one);

      const one = live().get(id);
      if (!one) return close();
      one.hears.add(hears);
      signal.addEventListener("abort", close);
    },
  });
}
