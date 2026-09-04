"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const GAP = 4;
const WIDTH = 200;

export type Choice = { key: string; label: string; count?: number; quiet?: boolean; icon?: ReactNode };

export default function Menu({
  legend,
  icon,
  choices,
  picked,
  onPick,
}: {
  legend: string;
  icon: ReactNode;
  choices: Choice[];
  picked: string | null;
  onPick: (key: string | null) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const held = anchor.current.getBoundingClientRect();
    setAt({
      top: held.bottom + GAP,
      left: Math.min(Math.max(GAP, held.right - WIDTH), window.innerWidth - WIDTH - GAP),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !sheet.current?.contains(target)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={legend}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex items-center rounded-field p-1 transition-[opacity,color] group-hover/head:text-base-content
          ${picked || open ? "text-base-content opacity-100" : "opacity-0 group-hover/head:opacity-60 focus-visible:opacity-100"}`}
      >
        {icon}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={sheet}
            role="menu"
            style={{ top: at.top, left: at.left, width: WIDTH }}
            className="fixed z-50 overflow-hidden rounded-box border border-base-300 bg-base-100 py-1 shadow-lg"
          >
            {choices.map((choice) => {
              const on = picked === choice.key;
              return (
                <button
                  key={choice.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    onPick(on ? null : choice.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs
                    transition-colors hover:bg-base-200 ${on ? "font-medium text-base-content" : choice.quiet ? "text-soft" : ""}`}
                >
                  {choice.icon}
                  <span className="flex-1 truncate">{choice.label}</span>
                  {choice.count != null && <span className="tnum font-mono text-soft">{choice.count}</span>}
                </button>
              );
            })}
            {picked && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onPick(null);
                  setOpen(false);
                }}
                className="mt-1 flex w-full items-center border-t border-base-200 px-3 pb-1 pt-2
                  text-left text-xs text-soft transition-colors hover:bg-base-200 hover:text-base-content"
              >
                Clear
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
