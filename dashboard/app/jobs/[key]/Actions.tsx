"use client";

import { Command } from "@/components/act";
import { useDeck } from "@/components/Deck";
import { Button, Section } from "@/components/ui";
import { offered } from "@/core/actions";
import type { Status } from "@/core/schema";

export default function Actions({ jobKey, status }: { jobKey: string; status: Status | null }) {
  const { draft } = useDeck();

  const available = offered(status);
  if (available.length === 0) return null;

  return (
    <Section title="Actions">
      <div className="flex flex-wrap items-center gap-1.5">
        {available.map(({ id }) => (
          <Button key={id} onClick={() => draft(id, jobKey)}>
            <Command id={id} />
          </Button>
        ))}
      </div>
    </Section>
  );
}
