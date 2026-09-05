"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import Glyph from "@/components/Glyph";
import Options from "@/components/Options";
import { Output, useRun, type Asking } from "@/components/run";
import { Stamp } from "@/components/ui";
import { commanded, type Action } from "@/lib/core/actions";
import { WAITING, WORKING } from "@/lib/core/standing";
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
  const [about, setAbout] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  const talks = actions.find((action) => action.asks);
  const busy = runs.some((held) => held.standing === WORKING);

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
      if (action.asks) {
        setAbout(held);
        detach();
        return input.current?.focus();
      }
      start(action.id, held);
    },
    [detach, start],
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
        <Output
          className="min-h-0 flex-1"
          lines={lines}
          working={working}
          asking={asking}
          onStop={stop}
          empty="Nothing said yet."
        />

        <div className="flex max-h-[45%] shrink-0 flex-col border-t border-base-300">
          <div className="flex shrink-0 items-center justify-between border-b border-base-300 px-3 py-2">
            <h2 className="eyebrow">Conversations</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
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
          </div>
          {runs.length > 0 && <div className="shrink-0 border-t border-base-300">{fresh}</div>}
        </div>
      </aside>
    </DeckContext.Provider>
  );
}
