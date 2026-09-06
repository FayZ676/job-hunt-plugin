"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const GAP = 4;
const WIDTH = 200;

export default function Popover({
  legend,
  icon,
  lit,
  trigger = "",
  className = "",
  children,
}: {
  legend: string;
  icon: ReactNode;
  lit?: boolean;
  trigger?: string;
  className?: string;
  children: (close: () => void) => ReactNode;
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
        onClick={(event) => {
          event.stopPropagation();
          setOpen(!open);
        }}
        className={`flex items-center rounded-field p-1 transition-[opacity,color] ${className}
          ${lit || open ? "text-base-content opacity-100" : `opacity-0 focus-visible:opacity-100 ${trigger}`}`}
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
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
