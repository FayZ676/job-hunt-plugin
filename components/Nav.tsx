"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/profile", "Profile"],
  ["/jobs", "Jobs"],
  ["/criteria", "Search Criteria"],
  ["/sources", "Sources"],
  ["/help", "Help"],
];

export default function Nav({ db }: { db: string }) {
  const here = usePathname();
  return (
    <nav aria-label="Sections"
         className="border-b border-base-300 bg-base-100 md:w-56 md:shrink-0 md:self-stretch
           md:border-b-0 md:border-r">
      <div className="flex items-center gap-4 px-4 py-3 md:sticky md:top-0 md:block md:px-5 md:py-7">
        <p className="eyebrow shrink-0 md:mb-6">Job</p>

        <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:block md:space-y-0.5">
          {LINKS.map(([href, label]) => {
            const active = here.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`block whitespace-nowrap rounded-field px-2.5 py-1.5 text-sm
                    transition-colors md:px-3 ${
                    active
                      ? "bg-base-200 font-medium text-base-content"
                      : "text-soft hover:bg-base-200 hover:text-base-content"}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 hidden break-all font-mono text-[10px] leading-relaxed text-soft md:block">
          <span className="eyebrow mb-1 block">Database</span>
          {db}
        </p>
      </div>
    </nav>
  );
}
