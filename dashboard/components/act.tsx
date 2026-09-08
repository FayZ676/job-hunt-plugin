"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { answered } from "@/components/edit/answered";
import { say } from "@/components/Toaster";
import { confirmDelete } from "@/components/ui";
import { discard } from "@/lib/web/edit";

export const Command = ({ id }: { id: string }) => (
  <span className="font-mono">
    <span className="text-soft">/job</span> {id}
  </span>
);

export function useDiscard() {
  const router = useRouter();
  return useCallback(
    async (key: string, what: string) => {
      if (!confirmDelete(what)) return;
      const result = await answered(discard(key));
      if ("error" in result) return say(result.error, true);
      say("deleted");
      router.refresh();
    },
    [router],
  );
}
