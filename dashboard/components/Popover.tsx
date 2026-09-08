"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import Flyout, { WIDTH, type Corner } from "./Flyout";

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
  const [from, setFrom] = useState<Corner | null>(null);

  const close = useCallback(() => setFrom(null), []);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={legend}
        aria-haspopup="menu"
        aria-expanded={Boolean(from)}
        onClick={(event) => {
          event.stopPropagation();
          const held = event.currentTarget.getBoundingClientRect();
          setFrom(from ? null : { top: held.top, bottom: held.bottom, left: held.right - WIDTH });
        }}
        className={`flex items-center rounded-field p-1 transition-[opacity,color] ${className}
          ${lit || from ? "text-base-content opacity-100" : `opacity-0 focus-visible:opacity-100 ${trigger}`}`}
      >
        {icon}
      </button>

      {from && (
        <Flyout from={from} keep={anchor} onClose={close}>
          {children(close)}
        </Flyout>
      )}
    </>
  );
}
