"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";

import Glyph from "@/components/Glyph";

import { answered } from "./answered";
import { say } from "@/components/Toaster";
import { save } from "@/lib/web/actions";

export function useReorder(table: string, rows: { rowid: number; seq?: unknown }[]) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const held = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = async (from: number, to: number) => {
    if (busy || to < 0 || to >= rows.length || from === to) return;
    setBusy(true);
    const order = rows.slice();
    order.splice(to, 0, ...order.splice(from, 1));
    for (const [place, row] of order.entries()) {
      if (row.seq === place) continue;
      const done = await answered(save(table, row.rowid, { seq: String(place) }));
      if ("error" in done) {
        say(done.error, true);
        break;
      }
    }
    setBusy(false);
    router.refresh();
  };

  const dropzone = (place: number) => ({
    "data-over": over === place && held.current !== place ? "" : undefined,
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(place);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      if (held.current !== null) move(held.current, place);
      held.current = null;
      setOver(null);
    },
  });

  const Grip = ({ place, what }: { place: number; what: string }) => (
    <span
      draggable={!busy}
      tabIndex={0}
      role="button"
      aria-label={`reorder ${what} — drag, or press the arrow keys`}
      title="Drag to reorder"
      onDragStart={(event) => {
        held.current = place;
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        held.current = null;
        setOver(null);
      }}
      onKeyDown={(event) => {
        const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        if (!step) return;
        event.preventDefault();
        move(place, place + step);
      }}
      className="flex cursor-grab select-none px-1 text-soft transition-colors
        hover:text-base-content active:cursor-grabbing"
    >
      <Glyph icon={GripVertical} />
    </span>
  );

  return { Grip, dropzone };
}
