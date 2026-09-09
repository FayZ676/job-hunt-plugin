"use client";

import { Command } from "@/components/act";
import { useDeck } from "@/components/Deck";
import { Button } from "@/components/ui";
import { describes } from "@/core/actions";

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
        <span key={id} data-tip={describes(id)} className="tooltip tooltip-loose tooltip-bottom [&:before]:text-left">
          <Button onClick={() => draft(id, argument)}>
            <Command id={id} />
          </Button>
        </span>
      ))}
    </div>
  );
}
