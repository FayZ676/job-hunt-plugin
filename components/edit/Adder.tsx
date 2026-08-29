"use client";

import { useState } from "react";
import NewRow from "./NewRow";
import type { Column } from "./columns";

export default function Adder({ table, columns, seed, label, hint }: {
  table: string;
  columns: Column[];
  seed?: Record<string, string>;
  label: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-field px-1.5 py-1 text-sm
                text-soft transition-colors hover:bg-base-200 hover:text-base-content">
        <span aria-hidden className="font-mono">+</span>{label}
      </button>
    );

  return (
    <div className="mt-2 rounded-box border border-base-300 bg-base-100 p-3">
      {hint && <p className="eyebrow mb-2">{hint}</p>}
      <NewRow table={table} columns={columns} seed={seed} label={label} autoFocus compact />
      <button type="button" onClick={() => setOpen(false)}
              className="mt-2 text-xs text-soft underline decoration-base-300 underline-offset-2
                hover:decoration-current">
        Done
      </button>
    </div>
  );
}
