"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

import Glyph from "@/components/Glyph";
import Popover from "@/components/Popover";

export type Option = { key: string; label: string; tone?: "grave"; icon?: ReactNode; onPick: () => void };

export default function Options({
  legend,
  options,
  trigger = "",
  className = "",
  lit,
}: {
  legend: string;
  options: Option[];
  trigger?: string;
  className?: string;
  lit?: boolean;
}) {
  return (
    <Popover
      legend={legend}
      icon={<Glyph icon={MoreVertical} size={18} />}
      trigger={trigger}
      className={className}
      lit={lit}
    >
      {(close) => (
        <>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                close();
                option.onPick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors
                ${option.tone === "grave" ? "text-error hover:bg-error hover:text-error-content" : "hover:bg-base-200"}`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}
