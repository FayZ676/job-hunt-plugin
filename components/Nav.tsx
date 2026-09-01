"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CircleHelp, User, type LucideIcon } from "lucide-react";
import Glyph from "./Glyph";
import Mark from "./Mark";

type Item = { href: string; label: string; icon: LucideIcon };

const SECTIONS: Item[] = [
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/help", label: "Help", icon: CircleHelp },
];

export default function Nav({ db }: { db: string }) {
  const here = usePathname();
  return (
    <nav aria-label="Sections"
         className="sticky top-0 z-40 border-b border-base-300 bg-base-100">
      <div className="mx-auto flex max-w-[104rem] items-center gap-4 px-4 py-2 md:px-6">
        <p className="flex shrink-0 items-center gap-2">
          <Mark size={17} />
          <span className="font-display text-mini font-semibold uppercase
            tracking-[0.14em]">Job</span>
        </p>

        <span aria-hidden className="h-4 w-px shrink-0 bg-base-300" />

        <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {SECTIONS.map(({ href, label, icon }) => {
            const active = here.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-field px-2.5 py-1
                    text-sm transition-colors ${
                    active
                      ? "bg-base-200 font-medium text-base-content"
                      : "text-soft hover:bg-base-200 hover:text-base-content"}`}
                >
                  <Glyph icon={icon} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p title={db}
           className="hidden min-w-0 shrink items-baseline gap-2 lg:flex">
          <span className="eyebrow shrink-0">Database</span>
          <span className="truncate font-mono text-micro text-soft">{db}</span>
        </p>
      </div>
    </nav>
  );
}
