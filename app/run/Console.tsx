"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListX, Trash2 } from "lucide-react";

import Glyph from "@/components/Glyph";
import { Output, useRun, type Asking } from "@/components/run";
import { Button, Empty, Section, Stack, Stamp } from "@/components/ui";
import type { Action } from "@/lib/core/actions";
import type { Run } from "@/lib/web/runs";

export type Opening = { action: string; argument: string };

const WATCH = 4000;
const WIPE = "Clear every finished conversation? They are gone for good.";
const ERASE = "Delete this conversation? It is gone for good.";

const clock = (started: string) =>
  new Date(started).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Console({
  actions,
  runs,
  opening,
}: {
  actions: Action[];
  runs: Run[];
  opening: Opening | null;
}) {
  const router = useRouter();
  const { lines, run, working, open, start, reply, detach, stop, erase, wipe } = useRun();
  const [about, setAbout] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const opened = useRef(false);

  const talks = actions.find((action) => action.asks);
  const busy = runs.some((held) => held.standing === "Working");

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
        onDetach: () => setAbout(""),
        input,
        onSay: (words) => {
          if (run) return reply(words);
          setAbout("");
          start(talks.id, about ? `About ${about}:\n\n${words}` : words, about || undefined);
        },
      }
    : null;

  return (
    <div className="@container">
      <div
        className="grid items-start gap-x-6 gap-y-8 @5xl:grid-cols-[26rem_minmax(0,1fr)]
        [&>div>section]:mb-0"
      >
        <div className="flex flex-col gap-8">
          <Section title="Actions">
            <Stack>
              {actions.map((action) => {
                const { id, does } = action;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pick(action)}
                    className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-x-2.5 gap-y-1
                      border-b border-base-200 px-3 py-2.5 text-left transition-colors last:border-0
                      hover:bg-base-200"
                  >
                    <span className="min-w-0 truncate font-mono text-sm">
                      <span className="text-soft">/job</span>
                      {id !== "all" && ` ${id}`}
                    </span>
                    <span className="col-start-1 text-xs text-soft">{does}</span>
                  </button>
                );
              })}
            </Stack>
          </Section>

          <Section title="Conversations">
            <Stack>
              {runs.length === 0 ? (
                <div className="px-3 py-6">
                  <Empty>Nothing has run yet.</Empty>
                </div>
              ) : (
                runs.map((held) => (
                  <button
                    key={held.id}
                    type="button"
                    onClick={() => open(held.id)}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5
                      gap-y-1 border-b border-base-200 px-3 py-2.5 text-left transition-colors
                      last:border-0 hover:bg-base-200 ${run === held.id ? "bg-base-200" : ""}`}
                  >
                    <span className="min-w-0 truncate font-mono text-sm">{held.title}</span>
                    <Stamp>{held.standing}</Stamp>
                    <span className="col-start-1 text-xs text-soft">{clock(held.started)}</span>
                  </button>
                ))
              )}
            </Stack>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <Section
            title="Conversation"
            aside={
              <span className="flex shrink-0 items-center gap-2">
                {runs.length > 0 && (
                  <Button onClick={() => confirm(WIPE) && wipe()} icon={<Glyph icon={ListX} size={12} />}>
                    Clear
                  </Button>
                )}
                {run && (
                  <Button
                    onClick={() => confirm(ERASE) && erase()}
                    tone="grave"
                    icon={<Glyph icon={Trash2} size={12} />}
                  >
                    Delete
                  </Button>
                )}
              </span>
            }
          >
            <Stack>
              <Output
                className="pane"
                lines={lines}
                working={working}
                asking={asking}
                onStop={stop}
                empty="Pick an action, or write a message."
              />
            </Stack>
          </Section>
        </div>
      </div>
    </div>
  );
}
