import type { ReactNode } from "react";

export default function Disclosure({ summary, meta, children, open }: {
  summary: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-panel">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <span className="text-dim transition-transform group-open:rotate-90">›</span>
        <span className="font-medium">{summary}</span>
        {meta && <span className="ml-auto text-xs text-dim">{meta}</span>}
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}
