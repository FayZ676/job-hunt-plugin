"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Empty, Mark, Prose, Section, Stack, Stamp } from "@/components/ui";
import type { Phase } from "@/lib/web/phases";

type Line = { kind: "said" | "note" | "wrong"; body: string };

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

export default function Console({ phases }: { phases: Phase[] }) {
  const router = useRouter();
  const [given, setGiven] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const stop = useRef<AbortController | null>(null);
  const tail = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const held = tail.current;
    if (held) held.scrollTop = held.scrollHeight;
  }, [lines]);

  const go = async (phase: string) => {
    const control = new AbortController();
    stop.current = control;
    setRunning(phase);
    setLines([]);

    try {
      const answered = await fetch("/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, argument: given[phase] ?? "" }),
        signal: control.signal,
      });
      if (!answered.ok || !answered.body) throw new Error(await answered.text());

      const reader = answered.body.getReader();
      const decoder = new TextDecoder();
      let held = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        held += decoder.decode(value, { stream: true });
        const parts = held.split("\n");
        held = parts.pop() ?? "";
        const fresh = parts.flatMap(read);
        if (fresh.length) setLines((standing) => [...standing, ...fresh]);
      }
    } catch (error) {
      if (!control.signal.aborted)
        setLines((standing) => [...standing, { kind: "wrong", body: (error as Error).message }]);
    }

    stop.current = null;
    setRunning(null);
    router.refresh();
  };

  return (
    <div className="@container">
      <div
        className="grid items-start gap-x-6 gap-y-8 @5xl:grid-cols-[26rem_minmax(0,1fr)]
        [&>div>section]:mb-0"
      >
        <div className="flex flex-col gap-8">
          <Section title="Actions">
            <Stack>
              {phases.map(({ id, takes, does }) => {
                const argument = given[id] ?? "";
                const busy = running === id;
                return (
                  <div
                    key={id}
                    className="grid grid-cols-[0.375rem_minmax(0,1fr)_auto] items-center gap-x-2.5
                      gap-y-2 border-b border-base-200 px-3 py-3 last:border-0"
                  >
                    <Mark on={busy} />
                    <span className="min-w-0 truncate font-mono text-sm">
                      <span className="text-soft">/job</span>
                      {id !== "all" && ` ${id}`}
                    </span>
                    {busy ? (
                      <Button onClick={() => stop.current?.abort()}>Stop</Button>
                    ) : (
                      <Button disabled={Boolean(running)} onClick={() => go(id)}>
                        Run
                      </Button>
                    )}

                    <p className="col-span-2 col-start-2 -mt-1 text-xs text-soft">{does}</p>

                    {takes && (
                      <input
                        className="field col-span-2 col-start-2 font-mono text-xs"
                        value={argument}
                        placeholder={takes}
                        disabled={Boolean(running)}
                        onChange={(event) => setGiven((standing) => ({ ...standing, [id]: event.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </Stack>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <Section title="Action output">
            <Stack>
              <div ref={tail} className="pane flex flex-col overflow-auto" aria-live="polite">
                {lines.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Empty>{running ? "Waiting for the first output." : "Run an action to watch it here."}</Empty>
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
            </Stack>
          </Section>
        </div>
      </div>
    </div>
  );
}
