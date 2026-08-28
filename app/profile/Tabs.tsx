"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { slug: string; label: string; missing: number };

export default function Tabs({ items }: { items: Tab[] }) {
  const here = usePathname();
  return (
    <div role="tablist" className="tabs tabs-box mb-7 flex-wrap justify-start">
      {items.map(({ slug, label, missing }) => (
        <Link key={slug} role="tab" href={`/profile/${slug}`}
              className={`tab gap-1.5 ${here === `/profile/${slug}` ? "tab-active" : ""}`}>
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
