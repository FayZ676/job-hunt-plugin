"use client";

import { useRouter } from "next/navigation";
import { remove } from "@/lib/actions";
import { say } from "@/components/Toaster";

export default function DeleteButton({ table, rowid, what = "this" }:
  { table: string; rowid: number; what?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={`delete ${what}`}
      title={`delete ${what}`}
      className="h-8 w-8 shrink-0 rounded-lg border border-line text-dim
        hover:border-bad hover:bg-bad-soft hover:text-bad"
      onClick={async () => {
        if (!confirm(`Delete ${what}? It is gone from your profile for good.`)) return;
        const result = await remove(table, rowid);
        if ("error" in result) return say(result.error, true);
        say("deleted");
        router.refresh();
      }}
    >
      ×
    </button>
  );
}
