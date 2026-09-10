"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { remove } from "@/lib/web/edit";
import { Ghost, confirmDelete } from "@/components/ui";
import Glyph from "@/components/Glyph";
import { say } from "@/components/Toaster";
import { answered } from "./answered";

export function useRemove() {
  const router = useRouter();
  return useCallback(
    async (table: string, rowid: number, what: string, onGone?: () => void) => {
      if (!confirmDelete(what)) return;
      const result = await answered(remove(table, rowid));
      if ("error" in result) return say(result.error, true);
      say("deleted");
      onGone?.();
      router.refresh();
    },
    [router],
  );
}

export default function DeleteButton({ table, rowid, what = "this" }: { table: string; rowid: number; what?: string }) {
  const drop = useRemove();

  return (
    <Ghost
      tone="grave"
      aria-label={`Delete ${what}`}
      title={`Delete ${what}`}
      onClick={() => drop(table, rowid, what)}
      icon={<Glyph icon={Trash2} size={13} />}
    />
  );
}
