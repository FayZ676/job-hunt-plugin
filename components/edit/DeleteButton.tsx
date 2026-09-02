"use client";

import { useRouter } from "next/navigation";
import { remove } from "@/lib/web/actions";
import { say } from "@/components/Toaster";
import { answered } from "./answered";

export default function DeleteButton({ table, rowid, what = "this" }: { table: string; rowid: number; what?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={`delete ${what}`}
      title={`delete ${what}`}
      className="rounded-field px-1.5 leading-none text-soft transition-colors
        hover:bg-base-200 hover:text-error"
      onClick={async () => {
        if (!confirm(`Delete ${what}? It is gone from your profile for good.`)) return;
        const result = await answered(remove(table, rowid));
        if ("error" in result) return say(result.error, true);
        say("deleted");
        router.refresh();
      }}
    >
      ×
    </button>
  );
}
