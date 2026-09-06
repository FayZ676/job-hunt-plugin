"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { remove, save } from "@/lib/web/edit";
import { say } from "@/components/Toaster";
import { answered } from "./answered";
import { Ghost } from "@/components/ui";

export default function Chips({
  table,
  column,
  rows,
  seed = {},
  placeholder,
}: {
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
          className="inline-flex items-center gap-1 rounded-selector border border-base-300
                py-0.5 pl-2 pr-1 text-xs"
        >
          {String(row[column])}
          <Ghost
            tight
            aria-label={`Remove ${String(row[column])}`}
            onClick={async () => act(await answered(remove(table, row.rowid)))}
          >
            ×
          </Ghost>
        </span>
      ))}
      <input
        className="quietbox w-40 border-dashed border-base-300 text-xs"
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
