"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/actions";
import { Control } from "./Field";
import { title, type Column } from "./columns";
import { say } from "@/components/Toaster";

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
      className={`rowgrid ${compact ? "" : "rounded-xl border border-dashed border-line p-3"}`}
      style={{ ["--tracks" as string]: columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ") + " auto" }}
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
      <button
        type="button"
        disabled={busy}
        onClick={add}
        className="h-8 shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink
          disabled:opacity-50 hover:brightness-110"
      >
        {label}
      </button>
    </div>
  );
}
