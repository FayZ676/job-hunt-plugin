"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { remove, save } from "@/lib/actions";
import { say } from "@/components/Toaster";
import { answered } from "./answered";

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
        <span key={row.rowid} className="badge badge-outline gap-1 pr-1">
          {String(row[column])}
          <button
            type="button"
            aria-label={`remove ${String(row[column])}`}
            className="btn btn-xs btn-circle btn-ghost"
            onClick={async () => act(await answered(remove(table, row.rowid)))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="input input-xs w-40 rounded-full"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={async (event) => {
          if (event.key !== "Enter" || !draft.trim()) return;
          event.preventDefault();
          const value = draft.trim();
          setDraft("");
          act(await answered(save(table, null, { ...seed, [column]: value })));
        }}
      />
    </div>
  );
}
