"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";

import Glyph from "@/components/Glyph";
import Markdown from "@/components/Markdown";
import { Button, Empty, Prose, Stamp } from "@/components/ui";

export type Line = { kind: "asked" | "said" | "aside" | "wrong" | "end"; body: string; note?: string };

export type Asked = { body: string; note?: string };

type Heard = { lines: Line[]; session?: string };

function read(line: string): Heard {
  let held: any;
  try {
    held = JSON.parse(line);
  } catch {
    return { lines: [] };
  }

  const session = typeof held.session_id === "string" ? held.session_id : undefined;
  const heard = (lines: Line[]): Heard => ({ lines, session });

  if (held.type === "assistant") {
    const blocks: any[] = held.message?.content ?? [];
    const said = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return heard(said ? [{ kind: "said" as const, body: said }] : []);
  }

  if (held.type === "result") {
    const body = String(held.result ?? "").trim();
    return heard(held.is_error && body ? [{ kind: "wrong", body }] : []);
  }

  if (held.type === "stderr") return heard([{ kind: "aside", body: String(held.text).trim() }]);
  if (held.type === "exit" && held.code) return heard([{ kind: "wrong", body: `claude exited ${held.code}` }]);
  return heard([]);
}

export function useRun() {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [session, setSession] = useState<string | null>(null);
  const control = useRef<AbortController | null>(null);
  const thread = useRef("");

  const run = async (action: string, argument: string, asked: Asked | undefined, resume: string | null) => {
    const held = new AbortController();
    control.current = held;
    setRunning(action);

    const opening: Line[] = asked ? [{ kind: "asked", ...asked }] : [];
    setLines((standing) => (resume ? [...standing, ...opening] : opening));

    let ended = "Finished";
    let seen: string | null = null;

    try {
      const answered = await fetch("/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, argument, resume }),
        signal: held.signal,
      });
      if (!answered.ok || !answered.body) throw new Error(await answered.text());

      const reader = answered.body.getReader();
      const decoder = new TextDecoder();
      let rest = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        rest += decoder.decode(value, { stream: true });
        const parts = rest.split("\n");
        rest = parts.pop() ?? "";
        for (const part of parts) {
          const { lines: fresh, session: id } = read(part);
          if (id) seen = id;
          if (fresh.some((line) => line.kind === "wrong")) ended = "Failed";
          if (fresh.length) setLines((standing) => [...standing, ...fresh]);
        }
      }
    } catch (error) {
      ended = held.signal.aborted ? "Stopped" : "Failed";
      if (!held.signal.aborted)
        setLines((standing) => [...standing, { kind: "wrong", body: (error as Error).message }]);
    }

    if (ended !== "Finished") setLines((standing) => [...standing, { kind: "end", body: ended }]);
    if (seen) setSession(seen);

    control.current = null;
    setRunning(null);
    router.refresh();
  };

  return {
    lines,
    running,
    session,
    start: (action: string, argument = "", asked?: Asked) => {
      thread.current = action;
      setSession(null);
      return run(action, argument, asked, null);
    },
    reply: (words: string) => run(thread.current || "feedback", words, { body: words }, session),
    clear: (action: string) => {
      thread.current = action;
      setSession(null);
      setLines([]);
    },
    stop: () => control.current?.abort(),
  };
}

const TONE: Record<string, string> = { wrong: "text-error", aside: "text-soft" };

const speaker = (line: Line) => (line.kind === "asked" ? "you" : line.kind === "said" ? "job" : null);

function Turn({ line, lead }: { line: Line; lead: boolean }) {
  const who = speaker(line);
  const mine = line.kind === "asked";

  if (line.kind === "end")
    return (
      <div className="px-4 py-2">
        <Stamp>{line.body}</Stamp>
      </div>
    );

  return (
    <div className={`px-4 ${lead ? "pt-3" : "pt-1"} pb-3 ${mine ? "bg-base-200" : ""}`}>
      {who && lead && (
        <p className="mb-1.5 flex items-baseline gap-2 font-mono text-xs text-soft">
          {who}
          {line.note && <Stamp>{line.note}</Stamp>}
        </p>
      )}
      {line.kind === "said" ? (
        <Markdown>{line.body}</Markdown>
      ) : (
        <Prose className={TONE[line.kind] ?? ""}>{line.body}</Prose>
      )}
    </div>
  );
}

export type Asking = {
  asks: string;
  about?: string;
  onDetach?: () => void;
  onSay: (said: string) => void;
  input?: RefObject<HTMLTextAreaElement | null>;
};

function Composer({
  asks,
  about,
  onDetach,
  onSay,
  input,
  said,
  onSaid,
  working,
  onStop,
}: Asking & { said: string; onSaid: (said: string) => void; working?: boolean; onStop?: () => void }) {
  const ready = said.trim().length > 0 && !working;

  return (
    <form
      className="border-t border-base-300 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onSay(said.trim());
        onSaid("");
      }}
    >
      {about && (
        <span
          className="mb-2 flex w-fit items-center gap-1 rounded-field border border-base-300
            bg-base-100 py-0.5 pl-2 pr-1"
        >
          <Stamp>{about}</Stamp>
          <button
            type="button"
            aria-label={`Send without ${about}`}
            onClick={onDetach}
            className="rounded-field px-1 text-xs leading-none text-soft transition-colors
              hover:bg-base-200 hover:text-base-content"
          >
            ×
          </button>
        </span>
      )}

      <textarea
        ref={input}
        rows={1}
        aria-label={asks}
        placeholder={asks}
        className="max-h-40 w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed
          placeholder:text-soft focus:outline-none"
        style={{ fieldSizing: "content" } as React.CSSProperties}
        value={said}
        onChange={(event) => onSaid(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
      />

      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-xs text-soft">Shift + Enter for a new line</p>
        {working ? (
          <Button onClick={onStop} className="inline-flex items-center gap-1.5">
            <Glyph icon={Square} size={11} className="fill-current" />
            Stop
          </Button>
        ) : (
          <Button type="submit" tone="firm" disabled={!ready}>
            Send
          </Button>
        )}
      </div>
    </form>
  );
}

export function Output({
  lines,
  empty,
  working,
  asking,
  onStop,
  className = "",
}: {
  lines: Line[];
  empty: string;
  working?: boolean;
  asking?: Asking | null;
  onStop?: () => void;
  className?: string;
}) {
  const tail = useRef<HTMLDivElement | null>(null);
  const [said, setSaid] = useState("");

  useEffect(() => {
    const held = tail.current;
    if (held) held.scrollTop = held.scrollHeight;
  }, [lines, working]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div ref={tail} className="flex min-h-0 flex-1 flex-col overflow-auto" aria-live="polite">
        {lines.length === 0 && !working ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty>{empty}</Empty>
          </div>
        ) : (
          <div>
            {lines.map((line, at) => (
              <Turn key={at} line={line} lead={speaker(line) !== speaker(lines[at - 1] ?? ({} as Line))} />
            ))}
            {working && (
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-soft">
                Working
                <span aria-hidden className="flex items-center gap-1">
                  {[0, 200, 400].map((delay) => (
                    <span
                      key={delay}
                      className="size-1.5 animate-blink bg-mark"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {asking && <Composer {...asking} said={said} onSaid={setSaid} working={working} onStop={onStop} />}
    </div>
  );
}
