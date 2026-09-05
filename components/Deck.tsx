"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";

import Glyph from "@/components/Glyph";
import Options from "@/components/Options";
import { Output, useRun, type Asking } from "@/components/run";
import { Empty } from "@/components/ui";
import { commanded, type Action } from "@/lib/core/actions";
import { DONE, WAITING, WORKING } from "@/lib/core/standing";
import type { Run } from "@/lib/web/runs";

const WATCH = 4000;
const ERASE = "Delete this conversation? It is gone for good.";
const KEPT = "deck";

const clock = (started: string) =>
  new Date(started).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Deck = { shown: boolean; toggle: () => void; run: (action: string, argument?: string) => void };

const DeckContext = createContext<Deck | null>(null);

export const useDeck = () => {
  const held = useContext(DeckContext);
  if (!held) throw new Error("useDeck outside Deck");
  return held;
};

const loud = (standing: string) => standing === WORKING || standing === WAITING;

function Standing({ standing }: { standing: string }) {
  if (standing === DONE) return null;
  return (
    <span className={`flex items-center gap-1.5 ${loud(standing) ? "text-signal" : "text-soft"}`}>
      {loud(standing) && (
        <span aria-hidden className={`size-1.5 bg-mark ${standing === WORKING ? "animate-blink" : ""}`} />
      )}
      {standing}
    </span>
  );
}

export default function Deck({
  actions,
  runs,
  seeds,
  nav,
  children,
}: {
  actions: Action[];
  runs: Run[];
  seeds: Record<string, string>;
  nav: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { lines, run, working, open, start, reply, detach, stop, erase } = useRun();
  const [shown, setShown] = useState(false);
  const [reading, setReading] = useState(false);
  const [about, setAbout] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  const talks = actions.find((action) => action.asks);
  const busy = runs.some((held) => held.standing === WORKING);
  const here = runs.find((held) => held.id === run);

  useEffect(() => {
    setShown(localStorage.getItem(KEPT) === "open");
  }, []);

  const toggle = useCallback(
    () =>
      setShown((was) => {
        localStorage.setItem(KEPT, was ? "shut" : "open");
        return !was;
      }),
    [],
  );

  useEffect(() => {
    if (!busy && !working) return;
    const timer = setInterval(() => router.refresh(), WATCH);
    return () => clearInterval(timer);
  }, [busy, working, router]);

  const pick = useCallback(
    (action: Action, held = "") => {
      setReading(true);
      if (action.asks) {
        setAbout(held);
        detach();
        return input.current?.focus();
      }
      start(action.id, held);
    },
    [detach, start],
  );

  const enter = useCallback(
    (id: string) => {
      setReading(true);
      open(id);
    },
    [open],
  );

  const fire = useCallback(
    (id: string, argument = "") => {
      const found = actions.find((action) => action.id === id);
      if (!found) return;
      setShown(true);
      localStorage.setItem(KEPT, "open");
      pick(found, argument);
    },
    [actions, pick],
  );

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

  const title = here?.title ?? "New chat";

  return (
    <DeckContext.Provider value={{ shown, toggle, run: fire }}>
      {nav}
      <div className={`transition-[padding] duration-200 ${shown ? "xl:pl-[30rem]" : ""}`}>{children}</div>

      {shown && (
        <button
          type="button"
          aria-label="Close conversations"
          onClick={toggle}
          className="fixed inset-x-0 bottom-0 top-[var(--nav)] z-20 bg-base-content/20 xl:hidden"
        />
      )}

      <aside
        aria-label="Conversations"
        aria-hidden={!shown}
        inert={!shown || undefined}
        className={`fixed bottom-0 left-0 top-[var(--nav)] z-30 flex w-[min(30rem,100vw)] flex-col
          border-r border-base-300 bg-base-100 transition-transform duration-200
          ${shown ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[var(--nav)] shrink-0 items-center gap-2 border-b border-base-300 px-3.5">
          {reading ? (
            <>
              <button
                type="button"
                onClick={() => setReading(false)}
                className="flex shrink-0 items-center gap-1 -ml-1.5 rounded-field py-1 pl-1.5 pr-2 text-mini
                  text-soft transition-colors hover:bg-base-200 hover:text-base-content"
              >
                <Glyph icon={ChevronLeft} size={15} />
                All
              </button>
              <h2 className="min-w-0 flex-1 truncate font-mono text-mini">{title}</h2>
              {here && (
                <span className="shrink-0 text-xs">
                  <Standing standing={here.standing} />
                </span>
              )}
            </>
          ) : (
            <>
              <h2 className="eyebrow flex-1">Conversations</h2>
              {talks && (
                <button
                  type="button"
                  onClick={() => pick(talks)}
                  className="flex shrink-0 items-center gap-1.5 -mr-2 rounded-field px-2 py-1 text-mini
                    text-soft transition-colors hover:bg-base-200 hover:text-base-content"
                >
                  <Glyph icon={Plus} size={12} />
                  New chat
                </button>
              )}
            </>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={`flex h-full w-[200%] transition-transform duration-200
              ${reading ? "-translate-x-1/2" : ""}`}
          >
            <div className="h-full w-1/2 overflow-auto" inert={reading || undefined}>
              {runs.length === 0 && <Empty>No conversations yet.</Empty>}
              {runs.map((held) => (
                <div key={held.id} className="group/row relative border-b border-base-200 last:border-0">
                  {loud(held.standing) && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-mark" />}
                  <button
                    type="button"
                    onClick={() => enter(held.id)}
                    className="grid w-full gap-y-1 px-3.5 py-3 text-left transition-colors hover:bg-base-200"
                  >
                    <span className="min-w-0 truncate font-mono text-mini">{held.title}</span>
                    <span className="flex items-center gap-2 text-xs text-soft">
                      {clock(held.started)}
                      <Standing standing={held.standing} />
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
            </div>

            <div className="h-full w-1/2" inert={!reading || undefined}>
              <Output
                className="h-full"
                lines={lines}
                working={working}
                asking={asking}
                onStop={stop}
                empty="Nothing said yet."
              />
            </div>
          </div>
        </div>
      </aside>
    </DeckContext.Provider>
  );
}
