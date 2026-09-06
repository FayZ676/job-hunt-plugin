"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { remove } from "@/lib/web/edit";
import { Button, Ghost, confirmDelete } from "@/components/ui";
import Glyph from "@/components/Glyph";
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
    if (!confirmDelete(what)) return;
    const result = await answered(remove(table, rowid));
    if ("error" in result) return say(result.error, true);
    say("deleted");
    onGone?.();
    router.refresh();
  };

  if (label)
    return (
      <Button tone="grave" onClick={drop} icon={<Glyph icon={Trash2} size={13} />}>
        {label}
      </Button>
    );

  return (
    <Ghost
      tone="grave"
      aria-label={`Delete ${what}`}
      title={`Delete ${what}`}
      onClick={drop}
      icon={<Glyph icon={Trash2} size={13} />}
    />
  );
}
