"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Empty, Prose, Stamp } from "@/components/ui";

export type Line = { kind: "said" | "note" | "wrong"; body: string };

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
    const tools = blocks.filter((block) => block.type === "tool_use").map((block) => block.name);
    return [
      ...(said ? [{ kind: "said" as const, body: said }] : []),
      ...(tools.length ? [{ kind: "note" as const, body: tools.join(" · ") }] : []),
    ];
  }

  if (held.type === "result")
    return [
      { kind: held.is_error ? ("wrong" as const) : ("said" as const), body: String(held.result ?? "").trim() },
      ...(typeof held.total_cost_usd === "number"
        ? [{ kind: "note" as const, body: `$${held.total_cost_usd.toFixed(2)}` }]
        : []),
    ].filter((line) => line.body);

  if (held.type === "stderr") return [{ kind: "wrong", body: String(held.text).trim() }];
  if (held.type === "exit" && held.code) return [{ kind: "wrong", body: `claude exited ${held.code}` }];
  return [];
}

export function useRun() {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [argument, setArgument] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const control = useRef<AbortController | null>(null);

  const start = async (phase: string, argument = "") => {
    const held = new AbortController();
    control.current = held;
    setRunning(phase);
    setArgument(argument);
    setLines([]);

    try {
      const answered = await fetch("/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, argument }),
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
        if (fresh.length) setLines((standing) => [...standing, ...fresh]);
      }
    } catch (error) {
      if (!held.signal.aborted)
        setLines((standing) => [...standing, { kind: "wrong", body: (error as Error).message }]);
    }

    control.current = null;
    setRunning(null);
    router.refresh();
  };

  return { lines, running, argument, start, stop: () => control.current?.abort() };
}

export function Output({ lines, empty, className = "" }: { lines: Line[]; empty: string; className?: string }) {
  const tail = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const held = tail.current;
    if (held) held.scrollTop = held.scrollHeight;
  }, [lines]);

  return (
    <div ref={tail} className={`flex flex-col overflow-auto ${className}`} aria-live="polite">
      {lines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Empty>{empty}</Empty>
        </div>
      ) : (
        <div className="divide-y divide-base-200">
          {lines.map((line, at) => (
            <div key={at} className="px-3 py-2">
              {line.kind === "note" ? (
                <Stamp>{line.body}</Stamp>
              ) : (
                <Prose className={line.kind === "wrong" ? "text-error" : ""}>{line.body}</Prose>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
