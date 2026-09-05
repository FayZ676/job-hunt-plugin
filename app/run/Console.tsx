"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import Glyph from "@/components/Glyph";
import Options from "@/components/Options";
import { Output, useRun, type Asking } from "@/components/run";
import { Section, Split, Stack, Stamp } from "@/components/ui";
import { commanded, type Action } from "@/lib/core/actions";
import { WAITING, WORKING } from "@/lib/core/standing";
import type { Run } from "@/lib/web/runs";

export type Opening = { action: string; argument: string };

const WATCH = 4000;
const ERASE = "Delete this conversation? It is gone for good.";

const clock = (started: string) =>
  new Date(started).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Console({
  actions,
  runs,
  seeds,
  opening,
}: {
  actions: Action[];
  runs: Run[];
  seeds: Record<string, string>;
  opening: Opening | null;
}) {
  const router = useRouter();
  const { lines, run, working, open, start, reply, detach, stop, erase } = useRun();
  const [about, setAbout] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const opened = useRef(false);

  const talks = actions.find((action) => action.asks);
  const busy = runs.some((held) => held.standing === WORKING);

  useEffect(() => {
    if (!busy && !working) return;
    const timer = setInterval(() => router.refresh(), WATCH);
    return () => clearInterval(timer);
  }, [busy, working, router]);

  const pick = useCallback(
    (action: Action, held = "") => {
      if (action.asks) {
        setAbout(held);
        detach();
        return input.current?.focus();
      }
      start(action.id, held);
    },
    [detach, start],
  );

  useEffect(() => {
    if (!opening || opened.current) return;
    opened.current = true;
    router.replace("/run");
    const found = actions.find(({ id }) => id === opening.action);
    if (found) pick(found, opening.argument);
  }, [actions, opening, pick, router]);

  const asking: Asking | null = talks
    ? {
        asks: talks.asks!,
        about: about || undefined,
        seeds,
        onDetach: () => setAbout(""),
        input,
        onSay: (words) => {
          if (run) return reply(words);
          const command = commanded(words);
          if (command) {
            setAbout("");
            return start(command.action, command.argument);
          }
          setAbout("");
          start(talks.id, about ? `About ${about}:\n\n${words}` : words, about || undefined);
        },
      }
    : null;

  const fresh = talks && (
    <button
      type="button"
      onClick={() => pick(talks)}
      className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm text-soft
        transition-colors hover:bg-base-200 hover:text-base-content"
    >
      <Glyph icon={Plus} size={12} />
      New chat
    </button>
  );

  const rail = (
    <Section title="Conversations">
      <Stack foot={runs.length > 0 ? fresh : null}>
        {runs.length === 0 && fresh}
        {runs.map((held) => (
          <div key={held.id} className="group/row relative border-b border-base-200 last:border-0">
            <button
              type="button"
              onClick={() => open(held.id)}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1
                      px-3 py-2.5 text-left transition-colors
                      hover:bg-base-200 ${run === held.id ? "bg-base-200" : ""}`}
            >
              <span className="col-span-2 min-w-0 truncate font-mono text-sm">{held.title}</span>
              <span className="text-xs text-soft">{clock(held.started)}</span>
              <span className="flex items-center gap-1.5">
                {(held.standing === WORKING || held.standing === WAITING) && (
                  <span
                    aria-hidden
                    className={`size-1.5 bg-mark ${held.standing === WORKING ? "animate-blink" : ""}`}
                  />
                )}
                <Stamp>{held.standing}</Stamp>
              </span>
            </button>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 flex border-l border-base-300
                bg-base-200 opacity-0 transition-opacity group-hover/row:pointer-events-auto
                group-hover/row:opacity-100 has-[[aria-expanded='true']]:pointer-events-auto
                has-[[aria-expanded='true']]:opacity-100"
            >
              <Options
                legend={`Options for ${held.title}`}
                className="h-full px-2.5"
                lit
                options={[
                  {
                    key: "erase",
                    label: "Delete chat",
                    tone: "grave",
                    icon: <Glyph icon={Trash2} size={13} />,
                    onPick: () => confirm(ERASE) && erase(held.id),
                  },
                ]}
              />
            </div>
          </div>
        ))}
      </Stack>
    </Section>
  );

  return (
    <Split rail={rail}>
      <Section title="Conversation">
        <Stack>
          <Output
            className="pane"
            lines={lines}
            working={working}
            asking={asking}
            onStop={stop}
            empty="Nothing said yet."
          />
        </Stack>
      </Section>
    </Split>
  );
}
