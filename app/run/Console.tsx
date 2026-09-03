"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";

import Glyph from "@/components/Glyph";
import { Output, useRun } from "@/components/run";
import { Button, Section, Stack, Stamp } from "@/components/ui";
import type { Action } from "@/lib/core/actions";

export type Opening = { action: string; argument: string };

export default function Console({ actions, opening }: { actions: Action[]; opening: Opening | null }) {
  const router = useRouter();
  const { lines, running, argument, start, stop } = useRun();
  const opened = useRef(false);

  useEffect(() => {
    if (!opening || opened.current) return;
    opened.current = true;
    router.replace("/run");
    start(opening.action, opening.argument);
  }, [opening, router, start]);

  return (
    <div className="@container">
      <div
        className="grid items-start gap-x-6 gap-y-8 @5xl:grid-cols-[26rem_minmax(0,1fr)]
        [&>div>section]:mb-0"
      >
        <div className="flex flex-col gap-8">
          <Section title="Actions">
            <Stack>
              {actions.map(({ id, does }) => {
                const command = (
                  <span className="min-w-0 truncate font-mono text-sm">
                    <span className="text-soft">/job</span>
                    {id !== "all" && ` ${id}`}
                  </span>
                );
                const said = <span className="col-start-1 text-xs text-soft">{does}</span>;

                return running === id ? (
                  <div
                    key={id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5
                      gap-y-1 border-b border-base-200 bg-base-200 px-3 py-2.5 last:border-0"
                  >
                    {command}
                    <Button onClick={stop} className="inline-flex items-center gap-1.5">
                      <Glyph icon={Square} size={11} className="fill-current" />
                      Stop
                    </Button>
                    {said}
                  </div>
                ) : (
                  <button
                    key={id}
                    type="button"
                    disabled={Boolean(running)}
                    onClick={() => start(id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-x-2.5
                      gap-y-1 border-b border-base-200 px-3 py-2.5 text-left transition-colors
                      last:border-0 hover:bg-base-200 disabled:hover:bg-transparent"
                  >
                    {command}
                    {said}
                  </button>
                );
              })}
            </Stack>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <Section title="Action output" aside={argument && <Stamp>{argument}</Stamp>}>
            <Stack>
              <Output
                className="pane"
                lines={lines}
                working={Boolean(running)}
                empty="Run an action to watch it here."
              />
            </Stack>
          </Section>
        </div>
      </div>
    </div>
  );
}
