"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CircleHelp, User, type LucideIcon } from "lucide-react";
import Glyph from "./Glyph";
import Mark from "./Mark";

type Item = { href: string; label: string; icon: LucideIcon };

const WORK: Item[] = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
];

const ASIDE: Item[] = [{ href: "/help", label: "Help", icon: CircleHelp }];

function Links({ items, here }: { items: Item[]; here: string }) {
  return (
    <ul className="flex min-w-0 gap-1 overflow-x-auto md:block md:space-y-0.5">
      {items.map(({ href, label, icon }) => {
        const active = here.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-field px-2.5 py-1.5
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
  );
}

export default function Nav({ db }: { db: string }) {
  const here = usePathname();
  return (
    <nav aria-label="Sections"
         className="border-b border-base-300 bg-base-100 md:w-56 md:shrink-0 md:self-stretch
           md:border-b-0 md:border-r">
      <div className="flex items-center gap-4 px-4 py-3 md:sticky md:top-0 md:h-dvh md:flex-col
        md:items-stretch md:gap-0 md:px-3 md:py-7">
        <p className="flex shrink-0 items-center gap-2 md:mb-6 md:px-2.5">
          <Mark size={18} />
          <span className="font-display text-mini font-semibold uppercase
            tracking-[0.14em]">Job</span>
        </p>

        <div className="min-w-0 flex-1 md:flex-none">
          <Links items={WORK} here={here} />
        </div>

        <div className="md:mt-auto md:space-y-8">
          <Links items={ASIDE} here={here} />

          <p className="hidden break-all px-2.5 font-mono text-micro leading-relaxed text-soft
            md:block">
            <span className="eyebrow mb-1 block">Database</span>
            {db}
          </p>
        </div>
      </div>
    </nav>
  );
}
