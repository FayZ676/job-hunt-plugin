"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as Clicked,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const GAP = 4;
export const WIDTH = 200;

export type Corner = { top: number; bottom: number; left: number };

export function useAnchored() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [from, setFrom] = useState<Corner | null>(null);

  const close = useCallback(() => setFrom(null), []);

  const toggle = useCallback((event: Clicked<HTMLButtonElement>) => {
    event.stopPropagation();
    const held = event.currentTarget.getBoundingClientRect();
    setFrom((open) => (open ? null : { top: held.top, bottom: held.bottom, left: held.right - WIDTH }));
  }, []);

  return { anchor, from, toggle, close };
}

export default function Flyout({
  from,
  keep,
  onClose,
  children,
}: {
  from: Corner;
  keep?: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const tall = sheet.current?.offsetHeight ?? 0;
    const under = from.bottom + GAP;
    setAt({
      top: under + tall > window.innerHeight - GAP ? Math.max(GAP, from.top - GAP - tall) : under,
      left: Math.min(Math.max(GAP, from.left), window.innerWidth - WIDTH - GAP),
    });
  }, [from]);

  useEffect(() => {
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!keep?.current?.contains(target) && !sheet.current?.contains(target)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [keep, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={sheet}
      role="menu"
      style={{ top: at?.top ?? 0, left: at?.left ?? 0, width: WIDTH, visibility: at ? "visible" : "hidden" }}
      className="fixed z-50 overflow-hidden rounded-box border border-base-300 bg-base-100 py-1 shadow-lg"
    >
      {children}
    </div>,
    document.body,
  );
}
