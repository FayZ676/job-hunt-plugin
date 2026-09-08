"use client";

import { useCallback, useState, type MouseEvent, type ReactNode } from "react";

import Flyout, { type Corner } from "@/components/Flyout";
import { Row } from "@/components/ui";

export type Option = { key: string; label: ReactNode; tone?: "grave"; icon?: ReactNode; onPick: () => void };

const List = ({ options, close }: { options: Option[]; close: () => void }) => (
  <>
    {options.map((option) => (
      <Row
        key={option.key}
        role="menuitem"
        tone={option.tone === "grave" ? "grave" : "quiet"}
        className="flex items-center gap-2"
        onClick={(event) => {
          event.stopPropagation();
          close();
          option.onPick();
        }}
      >
        {option.icon}
        {option.label}
      </Row>
    ))}
  </>
);

export function useRightClick<K>() {
  const [held, setHeld] = useState<{ key: K; at: Corner } | null>(null);
  const open = useCallback(
    (key: K, event: MouseEvent) => {
      event.preventDefault();
      setHeld({ key, at: { top: event.clientY, bottom: event.clientY, left: event.clientX } });
    },
    [],
  );
  const close = useCallback(() => setHeld(null), []);
  return { held, open, close };
}

export function Options({ at, options, onClose }: { at: Corner; options: Option[]; onClose: () => void }) {
  return (
    <Flyout from={at} onClose={onClose}>
      <List options={options} close={onClose} />
    </Flyout>
  );
}
