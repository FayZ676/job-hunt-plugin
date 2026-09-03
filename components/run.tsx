"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Markdown from "@/components/Markdown";
import { Empty, Prose, Stamp } from "@/components/ui";

export type Line = { kind: "said" | "aside" | "wrong" | "end"; body: string };

function read(line: string): Line[] {
  let held: any;
  try {
    held = JSON.parse(line);
  } catch {
    return [];
  }

  if (held.type === "assistant") {
    const blocks: any[] = held.message?.content ?? [];
    const said = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return said ? [{ kind: "said" as const, body: said }] : [];
  }

  if (held.type === "result") {
    const body = String(held.result ?? "").trim();
    return held.is_error && body ? [{ kind: "wrong", body }] : [];
  }

  if (held.type === "stderr") return [{ kind: "aside", body: String(held.text).trim() }];
  if (held.type === "exit" && held.code) return [{ kind: "wrong", body: `claude exited ${held.code}` }];
  return [];
}

export function useRun() {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [argument, setArgument] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const control = useRef<AbortController | null>(null);

  const start = async (action: string, argument = "") => {
    const held = new AbortController();
    control.current = held;
    setRunning(action);
    setArgument(argument);
    setLines([]);

    let ended = "Finished";

    try {
      const answered = await fetch("/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, argument }),
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
        const fresh = parts.flatMap(read);
        if (fresh.some((line) => line.kind === "wrong")) ended = "Failed";
        if (fresh.length) setLines((standing) => [...standing, ...fresh]);
      }
    } catch (error) {
      ended = held.signal.aborted ? "Stopped" : "Failed";
      if (!held.signal.aborted)
        setLines((standing) => [...standing, { kind: "wrong", body: (error as Error).message }]);
    }

    setLines((standing) => [...standing, { kind: "end", body: ended }]);

    control.current = null;
    setRunning(null);
    router.refresh();
  };

  return { lines, running, argument, start, stop: () => control.current?.abort() };
}

const TONE: Record<string, string> = { wrong: "text-error", aside: "text-soft" };

export function Output({
  lines,
  empty,
  working,
  className = "",
}: {
  lines: Line[];
  empty: string;
  working?: boolean;
  className?: string;
}) {
  const tail = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const held = tail.current;
    if (held) held.scrollTop = held.scrollHeight;
  }, [lines, working]);

  return (
    <div ref={tail} className={`flex flex-col overflow-auto ${className}`} aria-live="polite">
      {lines.length === 0 && !working ? (
        <div className="flex flex-1 items-center justify-center">
          <Empty>{empty}</Empty>
        </div>
      ) : (
        <div className="divide-y divide-base-200">
          {lines.map((line, at) => (
            <div key={at} className="px-3 py-2">
              {line.kind === "end" ? (
                <Stamp>{line.body}</Stamp>
              ) : line.kind === "said" ? (
                <Markdown>{line.body}</Markdown>
              ) : (
                <Prose className={TONE[line.kind]}>{line.body}</Prose>
              )}
            </div>
          ))}
          {working && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-soft">
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
  );
}
