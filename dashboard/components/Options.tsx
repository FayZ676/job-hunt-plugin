"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

import Glyph from "@/components/Glyph";
import Popover from "@/components/Popover";
import { Row } from "@/components/ui";

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
      )}
    </Popover>
  );
}
