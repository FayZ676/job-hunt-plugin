"use client";

import { Search } from "lucide-react";

import Popover from "@/components/Popover";

export default function Find({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Popover
      legend={legend}
      icon={<Search className="size-3" />}
      lit={Boolean(value)}
      trigger="group-hover/head:text-base-content group-hover/head:opacity-60"
    >
      {() => (
        <div className="p-1.5">
          <input
            autoFocus
            type="search"
            aria-label={legend}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-field border border-base-300 bg-base-100 px-2 py-1 text-xs
              placeholder:text-soft"
          />
        </div>
      )}
    </Popover>
  );
}
