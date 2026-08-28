"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { remove, save } from "@/lib/actions";
import { say } from "@/components/Toaster";

export default function Chips({ table, column, rows, seed = {}, placeholder }: {
  table: string;
  column: string;
  rows: ({ rowid: number } & Record<string, unknown>)[];
  seed?: Record<string, string>;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const router = useRouter();

  const act = async (result: Awaited<ReturnType<typeof save>>) => {
    if ("error" in result) return say(result.error, true);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rows.map((row) => (
        <span
          key={row.rowid}
          className="inline-flex items-center gap-1.5 rounded-full border border-line
            bg-panel py-1 pl-3 pr-1.5 text-xs"
        >
          {String(row[column])}
          <button
            type="button"
            aria-label={`remove ${String(row[column])}`}
            className="rounded-full px-1 leading-none text-dim hover:text-bad"
            onClick={async () => act(await remove(table, row.rowid))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="field !w-40 !rounded-full !py-1 text-xs"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={async (event) => {
          if (event.key !== "Enter" || !draft.trim()) return;
          event.preventDefault();
          const value = draft.trim();
          setDraft("");
          act(await save(table, null, { ...seed, [column]: value }));
        }}
      />
    </div>
  );
}
