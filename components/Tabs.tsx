"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string; missing?: number };

export default function Tabs({ items }: { items: Tab[] }) {
  const here = usePathname();
  return (
    <div role="tablist" className="tabs tabs-box mb-7 flex-wrap justify-start">
      {items.map(({ href, label, missing = 0 }) => (
        <Link key={href} role="tab" href={href}
              className={`tab gap-1.5 ${here === href ? "tab-active" : ""}`}>
          {label}
          {missing > 0 && (
            <span className="badge badge-xs badge-error" title={`${missing} unanswered`}>
              {missing}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
