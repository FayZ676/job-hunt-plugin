"use client";

import { Command } from "@/components/act";
import { useDeck } from "@/components/Deck";
import { Button } from "@/components/ui";

export default function Actions({
  ids,
  argument = "",
  className = "",
}: {
  ids: string[];
  argument?: string;
  className?: string;
}) {
  const { draft } = useDeck();

  if (ids.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {ids.map((id) => (
        <Button key={id} onClick={() => draft(id, argument)}>
          <Command id={id} />
        </Button>
      ))}
    </div>
  );
}
