"use client";

import { useRouter } from "next/navigation";

import { Button, Section } from "@/components/ui";
import { offered } from "@/lib/core/actions";
import type { Status } from "@/lib/core/schema";

const CONFIRM: Record<string, string> = {
  submit: "Submit this application? It goes to the employer as it is staged.",
};

export default function Actions({ jobKey, status }: { jobKey: string; status: Status | null }) {
  const router = useRouter();

  const available = offered(status);
  if (available.length === 0) return null;

  return (
    <Section title="Actions">
      <div className="flex flex-wrap items-center gap-1.5">
        {available.map(({ id }) => (
          <Button
            key={id}
            className="font-mono"
            onClick={() => {
              const ask = CONFIRM[id];
              if (ask && !confirm(ask)) return;
              router.push(`/run?run=${id}&key=${encodeURIComponent(jobKey)}`);
            }}
          >
            <span className="text-soft">/job</span> {id}
          </Button>
        ))}
      </div>
    </Section>
  );
}
