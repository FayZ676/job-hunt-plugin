"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { answered } from "@/components/edit/answered";
import { asked } from "@/lib/actions";
import { say } from "@/components/Toaster";
import { discard } from "@/lib/edit";

export const copyKey = (key: string) =>
  navigator.clipboard.writeText(key).then(
    () => say("Job ID copied"),
    () => say("Could not copy the job ID", true),
  );

export const Command = ({ id, argument = "" }: { id: string; argument?: string }) => (
  <span className="font-mono">
    <span className="text-soft">/job</span>
    {asked(id, argument).slice("/job".length)}
  </span>
);

export function useDiscard() {
  const router = useRouter();
  return useCallback(
    async (key: string) => {
      const result = await answered(discard(key));
      if ("error" in result) return say(result.error, true);
      say("deleted");
      router.refresh();
    },
    [router],
  );
}
