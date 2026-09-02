"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { Output, useRun } from "@/components/run";
import { Button, Mark, Section, Stack, Stamp } from "@/components/ui";
import type { Phase } from "@/lib/web/phases";

export type Opening = { phase: string; argument: string };

export default function Console({ phases, opening }: { phases: Phase[]; opening: Opening | null }) {
  const router = useRouter();
  const { lines, running, argument, start, stop } = useRun();
  const opened = useRef(false);

  useEffect(() => {
    if (!opening || opened.current) return;
    opened.current = true;
    router.replace("/run");
    start(opening.phase, opening.argument);
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
              {phases.map(({ id, does }) => {
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
                      <Button onClick={stop}>Stop</Button>
                    ) : (
                      <Button disabled={Boolean(running)} onClick={() => start(id)}>
                        Run
                      </Button>
                    )}

                    <p className="col-span-2 col-start-2 -mt-1 text-xs text-soft">{does}</p>
                  </div>
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
                empty={running ? "Waiting for the first output." : "Run an action to watch it here."}
              />
            </Stack>
          </Section>
        </div>
      </div>
    </div>
  );
}
