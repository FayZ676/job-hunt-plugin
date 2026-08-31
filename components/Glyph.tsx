import type { LucideIcon } from "lucide-react";

export default function Glyph({ icon: Icon, size = 14, className = "" }:
  { icon: LucideIcon; size?: number; className?: string }) {
  return (
    <Icon aria-hidden
          size={size}
          strokeWidth={1.5}
          absoluteStrokeWidth
          className={`shrink-0 ${className}`} />
  );
}
