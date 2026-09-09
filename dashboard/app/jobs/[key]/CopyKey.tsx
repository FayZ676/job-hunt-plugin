"use client";

import { Copy } from "lucide-react";
import { copyKey } from "@/components/act";
import Glyph from "@/components/Glyph";
import { Ghost } from "@/components/ui";

export default function CopyKey({ jobKey }: { jobKey: string }) {
  return (
    <Ghost
      onClick={() => copyKey(jobKey)}
      aria-label={`Copy job ID ${jobKey}`}
      icon={<Glyph icon={Copy} size={13} />}
      className="tnum -mr-2 font-mono text-xs"
    >
      {jobKey}
    </Ghost>
  );
}
