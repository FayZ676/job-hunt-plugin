"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";

import Glyph from "@/components/Glyph";
import { Options, useRightClick } from "@/components/Options";
import { Output, useRun, type Asking } from "@/components/run";
import { Empty, Ghost, Row } from "@/components/ui";
import { asked, commanded, type Action } from "@/core/actions";
import { DONE, WAITING, WORKING } from "@/core/standing";
import type { Run } from "@/lib/web/runs";

const WATCH = 4000;
const KEPT = "deck";

const clock = (started: string) =>
  new Date(started).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Deck = {
  shown: boolean;
  working: boolean;
  waiting: number;
  toggle: () => void;
  draft: (action: string, argument?: string) => void;
};

const DeckContext = createContext<Deck | null>(null);

export const useDeck = () => {
  const held = useContext(DeckContext);
  if (!held) throw new Error("useDeck outside Deck");
  return held;
};

function Standing({ standing }: { standing: string }) {
  if (standing === DONE) return null;

  if (standing === WAITING)
    return (
      <span className="inline-flex items-center bg-mark px-1.5 py-0.5 font-medium text-mark-content">
        {standing}
      </span>
    );

  return (
    <span className={`flex items-center gap-1.5 ${standing === WORKING ? "font-medium text-mark" : "text-soft"}`}>
      {standing === WORKING && <span aria-hidden className="size-1.5 animate-blink bg-current" />}
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
  const [said, setSaid] = useState("");
  const { held: raised, open: raise, close: lower } = useRightClick<string>();
  const input = useRef<HTMLTextAreaElement>(null);

  const talks = actions.find((action) => action.asks);
  const busy = runs.some((held) => held.standing === WORKING);
  const waiting = runs.filter((held) => held.standing === WAITING).length;
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
    const tag = document.querySelector("title");
    if (!tag) return;
    const apply = () => {
      const bare = (tag.textContent ?? "").replace(/^\(\d+\)\s/, "");
      const want = waiting ? `(${waiting}) ${bare}` : bare;
      if (tag.textContent !== want) tag.textContent = want;
    };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(tag, { childList: true, characterData: true, subtree: true });
    return () => watch.disconnect();
  }, [waiting]);

  useEffect(() => {
    if (!busy && !working) return;
    const timer = setInterval(() => router.refresh(), WATCH);
    return () => clearInterval(timer);
  }, [busy, working, router]);

  const fresh = useCallback(
    (words?: string) => {
      flushSync(() => {
        setReading(true);
        if (words !== undefined) setSaid(words);
        detach();
      });
      input.current?.focus({ preventScroll: true });
    },
    [detach],
  );

  const draft = useCallback(
    (id: string, argument = "") => {
      setShown(true);
      localStorage.setItem(KEPT, "open");
      fresh(`${asked(id, argument)} `);
    },
    [fresh],
  );

  const enter = useCallback(
    (id: string) => {
      setReading(true);
      open(id);
    },
    [open],
  );

  const asking: Asking | null = talks
    ? {
        asks: talks.asks!,
        seeds,
        said,
        onSaid: setSaid,
        input,
        onSay: (words) => {
          if (run) return reply(words);
          const command = commanded(words);
          if (command) return start(command.action, command.argument);
          start(talks.id, words);
        },
      }
    : null;

  const title = here?.title ?? "New chat";

  return (
    <DeckContext.Provider value={{ shown, working: busy || working, waiting, toggle, draft }}>
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
              <Ghost
                onClick={() => setReading(false)}
                className="-ml-2 gap-1 text-mini"
                icon={<Glyph icon={ChevronLeft} size={15} />}
              >
                All
              </Ghost>
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
                <Ghost onClick={() => fresh()} className="-mr-2 text-mini" icon={<Glyph icon={Plus} size={12} />}>
                  New chat
                </Ghost>
              )}
            </>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-clip">
          <div
            className={`flex h-full w-[200%] transition-transform duration-200
              ${reading ? "-translate-x-1/2" : ""}`}
          >
            <div className="h-full w-1/2 overflow-auto" inert={reading || undefined}>
              {runs.length === 0 && <Empty>No conversations yet.</Empty>}
              {runs.map((held) => (
                <div
                  key={held.id}
                  className={`relative border-b border-rule last:border-0
                    ${held.standing === WAITING ? "bg-mark/[0.07]" : ""}`}
                >
                  {held.standing === WAITING && (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-mark" />
                  )}
                  <Row
                    roomy
                    onClick={() => enter(held.id)}
                    onContextMenu={(event) => raise(held.id, event)}
                    className={`grid gap-y-1 ${raised?.key === held.id ? "bg-base-200" : ""}`}
                  >
                    <span className="min-w-0 truncate font-mono text-mini">{held.title}</span>
                    <span className="flex items-center gap-2 text-xs text-soft">
                      {clock(held.started)}
                      <Standing standing={held.standing} />
                    </span>
                  </Row>
                </div>
              ))}

              {raised && (
                <Options
                  at={raised.at}
                  onClose={lower}
                  options={[
                    {
                      key: "erase",
                      label: "Delete chat",
                      tone: "grave",
                      icon: <Glyph icon={Trash2} size={13} />,
                      onPick: () => erase(raised.key),
                    },
                  ]}
                />
              )}
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
