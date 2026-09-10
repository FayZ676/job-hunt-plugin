"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type Tab = { href: string; label: string; missing?: number; icon?: ReactNode };

export default function Tabs({
  items,
  label = "Views",
  trailing,
}: {
  items: Tab[];
  label?: string;
  trailing?: ReactNode;
}) {
  const here = usePathname();
  return (
    <nav aria-label={label} className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-base-300">
      {items.map(({ href, label: text, missing = 0, icon }) => {
        const active = here === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            data-tip={text}
            className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-sm
              transition-colors max-sm:tooltip max-sm:tooltip-bottom ${
                active
                  ? "border-base-content font-medium text-base-content"
                  : "border-transparent text-soft hover:border-base-300 hover:text-base-content"
              }`}
          >
            {icon}
            <span className="max-sm:sr-only">{text}</span>
            {missing > 0 && (
              <span
                className="tnum rounded-selector bg-signal px-1.5 py-px text-micro
                font-semibold text-accent-content"
              >
                {missing}
                <span className="sr-only"> unanswered</span>
              </span>
            )}
          </Link>
        );
      })}
      {trailing && <span className="ml-auto pb-2">{trailing}</span>}
    </nav>
  );
}
