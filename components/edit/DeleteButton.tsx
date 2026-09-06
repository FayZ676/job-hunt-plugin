"use client";

import { useRouter } from "next/navigation";
import { remove } from "@/lib/web/edit";
import { Button } from "@/components/ui";
import { say } from "@/components/Toaster";
import { answered } from "./answered";

export default function DeleteButton({
  table,
  rowid,
  what = "this",
  label,
  onGone,
}: {
  table: string;
  rowid: number;
  what?: string;
  label?: string;
  onGone?: () => void;
}) {
  const router = useRouter();

  const drop = async () => {
    if (!confirm(`Delete ${what}? This cannot be undone.`)) return;
    const result = await answered(remove(table, rowid));
    if ("error" in result) return say(result.error, true);
    say("deleted");
    onGone?.();
    router.refresh();
  };

  if (label)
    return (
      <Button tone="grave" onClick={drop}>
        {label}
      </Button>
    );

  return (
    <button
      type="button"
      aria-label={`delete ${what}`}
      title={`delete ${what}`}
      className="rounded-field px-1.5 leading-none text-soft transition-colors
        hover:bg-base-200 hover:text-error"
      onClick={drop}
    >
      ×
    </button>
  );
}
