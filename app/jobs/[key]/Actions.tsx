"use client";

import { useRouter } from "next/navigation";
import type { z } from "zod";

import { Button, Section } from "@/components/ui";
import type { TABLES } from "@/lib/core/schema";

type Status = NonNullable<z.infer<typeof TABLES.postings.shape.status>>;

type Action = { id: string; when: Status[]; confirm?: string };

const ACTIONS: Action[] = [
  { id: "score", when: ["new", "scored", "shortlisted", "skipped"] },
  { id: "resume", when: ["shortlisted", "staged"] },
  { id: "apply", when: ["shortlisted"] },
  {
    id: "submit",
    when: ["staged"],
    confirm: "Submit this application? It goes to the employer as it is staged.",
  },
];

export default function Actions({ jobKey, status }: { jobKey: string; status: Status | null }) {
  const router = useRouter();

  const offered = status ? ACTIONS.filter((action) => action.when.includes(status)) : [];
  if (offered.length === 0) return null;

  return (
    <Section title="Actions">
      <div className="flex flex-wrap items-center gap-1.5">
        {offered.map(({ id, confirm: ask }) => (
          <Button
            key={id}
            className="font-mono"
            onClick={() => {
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
