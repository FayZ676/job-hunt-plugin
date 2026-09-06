"use client";

import type { ReactNode } from "react";

import Popover from "@/components/Popover";
import { Row } from "@/components/ui";

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
  return (
    <Popover
      legend={legend}
      icon={icon}
      lit={Boolean(picked)}
      trigger="group-hover/head:text-base-content group-hover/head:opacity-60"
    >
      {(close) => (
        <>
          {choices.map((choice) => {
            const on = picked === choice.key;
            return (
              <Row
                key={choice.key}
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  onPick(on ? null : choice.key);
                  close();
                }}
                className={`flex items-center gap-2 ${on ? "font-medium text-base-content" : choice.quiet ? "text-soft" : ""}`}
              >
                {choice.icon}
                <span className="flex-1 truncate">{choice.label}</span>
                {choice.count != null && <span className="tnum font-mono text-soft">{choice.count}</span>}
              </Row>
            );
          })}
          {picked && (
            <Row
              role="menuitem"
              onClick={() => {
                onPick(null);
                close();
              }}
              className="mt-1 border-t border-base-200 text-soft hover:text-base-content"
            >
              Clear
            </Row>
          )}
        </>
      )}
    </Popover>
  );
}
