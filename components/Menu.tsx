"use client";

import type { ReactNode } from "react";

import Popover from "@/components/Popover";

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
              <button
                key={choice.key}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  onPick(on ? null : choice.key);
                  close();
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
                close();
              }}
              className="mt-1 flex w-full items-center border-t border-base-200 px-3 pb-1 pt-2
                text-left text-xs text-soft transition-colors hover:bg-base-200 hover:text-base-content"
            >
              Clear
            </button>
          )}
        </>
      )}
    </Popover>
  );
}
