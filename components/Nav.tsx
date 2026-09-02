"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Database, Play, User, type LucideIcon } from "lucide-react";
import Glyph from "./Glyph";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

type Item = { href: string; label: string; icon: LucideIcon };

const SECTIONS: Item[] = [
  { href: "/run", label: "Run", icon: Play },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Nav({ db }: { db: string }) {
  const here = usePathname();
  return (
    <nav aria-label="Sections" className="sticky top-0 z-40 border-b border-base-300 bg-base-100">
      <div className="mx-auto flex max-w-[104rem] items-center gap-4 px-4 py-2 md:px-6">
        <p className="flex shrink-0 items-center gap-2">
          <Wordmark size={17} />
          <span
            className="font-display text-mini font-semibold uppercase
            tracking-[0.14em]"
          >
            Job
          </span>
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
                        : "text-soft hover:bg-base-200 hover:text-base-content"
                    }`}
                >
                  <Glyph icon={icon} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <ThemeToggle />

        <span
          data-tip={db}
          className="tooltip tooltip-left shrink-0 text-soft
            before:max-w-[min(28rem,80vw)] before:whitespace-normal before:break-all
            before:font-mono before:text-micro"
        >
          <span className="sr-only">Database at {db}</span>
          <Glyph icon={Database} size={16} />
        </span>
      </div>
    </nav>
  );
}
