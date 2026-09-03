"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal, Square } from "lucide-react";

import Glyph from "@/components/Glyph";
import Markdown from "@/components/Markdown";
import { Button, Empty, Prose, Stamp } from "@/components/ui";
import type { Line } from "@/lib/web/runs";

const parse = (line: string): Line | null => {
  try {
    return JSON.parse(line) as Line;
  } catch {
    return null;
  }
};

async function ask(body: unknown): Promise<Response> {
  const answered = await fetch("/run/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!answered.ok) throw new Error(await answered.text());
  return answered;
}

async function told(body: unknown): Promise<string> {
  const { run } = (await (await ask(body)).json()) as { run: string };
  return run;
}

export function useRun() {
  const router = useRouter();
  const [run, setRun] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [streaming, setStreaming] = useState(false);
  const control = useRef<AbortController | null>(null);

  const open = useCallback(
    async (id: string) => {
      control.current?.abort();
      const watching = new AbortController();
      control.current = watching;

      setRun(id);
      setLines([]);
      setStreaming(true);

      try {
        const answered = await fetch(`/run/stream?run=${id}`, { signal: watching.signal });
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
          const fresh = parts.map(parse).filter(Boolean) as Line[];
          if (fresh.length) setLines((standing) => [...standing, ...fresh]);
        }
      } catch (error) {
        if (watching.signal.aborted) return;
        setLines((standing) => [...standing, { kind: "wrong", body: (error as Error).message }]);
      }

      if (watching.signal.aborted) return;
      setStreaming(false);
      router.refresh();
    },
    [router],
  );

  const send = useCallback(
    async (body: unknown) => {
      try {
        const id = await told(body);
        router.refresh();
        return open(id);
      } catch (error) {
        control.current?.abort();
        setRun(null);
        setStreaming(false);
        setLines([{ kind: "wrong", body: (error as Error).message }]);
      }
    },
    [open, router],
  );

  const detach = useCallback(() => {
    control.current?.abort();
    control.current = null;
    setRun(null);
    setStreaming(false);
    setLines([]);
  }, []);

  const forget = useCallback(
    async (body: unknown) => {
      try {
        await ask(body);
      } catch (error) {
        return setLines((standing) => [...standing, { kind: "wrong", body: (error as Error).message }]);
      }
      detach();
      router.refresh();
    },
    [detach, router],
  );

  return {
    lines,
    run,
    working: streaming && lines.at(-1)?.kind !== "end",
    open,
    start: (action: string, argument = "", note?: string) => send({ action, argument, note }),
    reply: (words: string) => send({ run, argument: words }),
    detach,
    stop: () => {
      if (run) void told({ stop: run });
    },
    erase: () => {
      if (run) void forget({ erase: run });
    },
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
          <Button onClick={onStop} icon={<Glyph icon={Square} size={11} className="fill-current" />}>
            Stop
          </Button>
        ) : (
          <Button type="submit" tone="firm" disabled={!ready} icon={<Glyph icon={SendHorizontal} size={12} />}>
            Send
          </Button>
        )}
      </div>
    </form>
  );
}

function span(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function Elapsed() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const since = Date.now();
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - since) / 1000)), 250);
    return () => clearInterval(tick);
  }, []);

  return <span className="tabular-nums">({span(seconds)})</span>;
}

// TODO: Rename this component.
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
                <Elapsed />
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
