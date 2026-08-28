"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/actions";
import { Control } from "./Field";
import { tracks } from "./FieldRow";
import { say } from "@/components/Toaster";
import type { Column } from "./columns";

export default function NewRow({ table, columns, seed = {}, label = "Add", compact }: {
  table: string;
  columns: Column[];
  seed?: Record<string, string>;
  label?: string;
  compact?: boolean;
}) {
  const blank = Object.fromEntries(columns.map((column) => [column.name, ""]));
  const [draft, setDraft] = useState<Record<string, string>>(blank);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const add = async () => {
    if (!Object.values(draft).some((value) => value.trim())) return;
    setBusy(true);
    const result = await save(table, null, { ...seed, ...draft });
    setBusy(false);
    if ("error" in result) return say(result.error, true);
    setDraft(blank);
    say("added");
    router.refresh();
  };

  return (
    <div
      className={`rowgrid ${compact ? "" : "rounded-box border border-dashed border-base-300 p-3"}`}
      style={tracks(columns)}
      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); add(); } }}
    >
      {columns.map((column) => (
        <Control
          key={column.name}
          column={column}
          value={draft[column.name]}
          onValue={(value) => setDraft({ ...draft, [column.name]: value })}
        />
      ))}
      <button type="button" disabled={busy} onClick={add} className="btn btn-sm btn-primary">
        {label}
      </button>
    </div>
  );
}
