"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/web/actions";
import { Button } from "@/components/ui";
import { say } from "@/components/Toaster";
import { answered } from "./answered";
import { Control } from "./Field";
import { title, type Column } from "./columns";

export default function Adder({
  table,
  columns,
  seed = {},
  label,
}: {
  table: string;
  columns: Column[];
  seed?: Record<string, string>;
  label: string;
}) {
  const blank = Object.fromEntries(columns.map((column) => [column.name, ""]));
  const [draft, setDraft] = useState<Record<string, string>>(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const held = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const add = async () => {
    if (!Object.values(draft).some((value) => value.trim())) return;
    const wrong = held.current?.querySelector<HTMLInputElement>(":invalid");
    if (wrong) return say(wrong.validationMessage, true);
    setBusy(true);
    const result = await answered(save(table, null, { ...seed, ...draft }));
    setBusy(false);
    if ("error" in result) return say(result.error, true);
    setDraft(blank);
    say("added");
    router.refresh();
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm text-soft
                transition-colors hover:bg-base-200 hover:text-base-content"
      >
        <span aria-hidden className="font-mono">
          +
        </span>
        {label}
      </button>
    );

  return (
    <div
      ref={held}
      className="space-y-2 bg-base-200 px-3 py-2.5"
      onKeyDown={(event) => {
        if (event.key === "Escape") return setOpen(false);
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        add();
      }}
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        {columns.map((column, index) => (
          <label key={column.name} className="min-w-40 flex-1">
            <span className="eyebrow mb-0.5 block">{title(column)}</span>
            <Control
              column={column}
              autoFocus={index === 0}
              value={draft[column.name]}
              onValue={(value) => setDraft({ ...draft, [column.name]: value })}
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Button tone="firm" disabled={busy} onClick={add}>
          {label}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-soft underline decoration-base-300 underline-offset-2
                  hover:decoration-current"
        >
          Done
        </button>
      </div>
    </div>
  );
}
