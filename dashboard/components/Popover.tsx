"use client";

import type { ReactNode } from "react";

import Flyout, { useAnchored } from "./Flyout";

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
  const { anchor, from, toggle, close } = useAnchored();

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={legend}
        aria-haspopup="menu"
        aria-expanded={Boolean(from)}
        onClick={toggle}
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
