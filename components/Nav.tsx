"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Database, User, type LucideIcon } from "lucide-react";
import { useDeck } from "./Deck";
import Glyph from "./Glyph";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

type Item = { href: string; label: string; icon: LucideIcon };

const SECTIONS: Item[] = [
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Nav({ db }: { db: string }) {
  const here = usePathname();
  const { shown, toggle } = useDeck();
  return (
    <nav aria-label="Sections" className="sticky top-0 z-40 border-b border-base-300 bg-base-100">
      <div className="mx-auto flex h-[var(--nav)] max-w-[104rem] items-center gap-4 px-4 md:px-6">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={shown}
          aria-label="Conversations"
          className={`flex shrink-0 items-center rounded-field px-1.5 py-1 transition-colors
            hover:bg-base-200 ${shown ? "bg-base-200" : ""}`}
        >
          <Wordmark size={17} />
        </button>

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
