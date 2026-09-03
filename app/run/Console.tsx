"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Output, useRun, type Asking } from "@/components/run";
import { Section, Stack } from "@/components/ui";
import { asked, type Action } from "@/lib/core/actions";

export type Opening = { action: string; argument: string };

export default function Console({ actions, opening }: { actions: Action[]; opening: Opening | null }) {
  const router = useRouter();
  const { lines, running, session, start, reply, clear, stop } = useRun();
  const [about, setAbout] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const opened = useRef(false);

  const talks = actions.find((action) => action.asks);

  const pick = useCallback(
    (action: Action, held = "") => {
      if (action.asks) {
        setAbout(held);
        clear(action.id);
        return input.current?.focus();
      }
      start(action.id, held, { body: asked(action.id, held) });
    },
    [clear, start],
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
          if (session) return reply(words);
          setAbout("");
          start(talks.id, about ? `About ${about}:\n\n${words}` : words, { body: words, note: about || undefined });
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
                    disabled={Boolean(running)}
                    onClick={() => pick(action)}
                    className={`grid w-full grid-cols-[minmax(0,1fr)] items-center gap-x-2.5
                      gap-y-1 border-b border-base-200 px-3 py-2.5 text-left transition-colors
                      last:border-0 hover:bg-base-200 disabled:hover:bg-transparent
                      ${running === id ? "bg-base-200" : ""}`}
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
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <Section title="Action output">
            <Stack>
              <Output
                className="pane"
                lines={lines}
                working={Boolean(running)}
                asking={asking}
                onStop={stop}
                empty="Nothing has run yet."
              />
            </Stack>
          </Section>
        </div>
      </div>
    </div>
  );
}
