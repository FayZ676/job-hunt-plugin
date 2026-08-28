"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/profile", "Profile"],
  ["/jobs", "Jobs"],
  ["/sources", "Sources"],
  ["/help", "Help"],
];

export default function Nav({ db }: { db: string }) {
  const here = usePathname();
  return (
    <nav className="border-b border-line bg-panel px-4 py-3 md:sticky md:top-0 md:h-screen
      md:w-52 md:shrink-0 md:border-b-0 md:border-r md:px-3 md:py-6">
      <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">Job</p>
      <div className="flex flex-wrap gap-1 md:block">
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`block rounded-lg px-3 py-2 text-sm md:mb-0.5 ${here.startsWith(href)
              ? "bg-accent text-accent-ink"
              : "hover:bg-sunk"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <p className="mt-5 hidden break-all px-2 font-mono text-[10px] leading-relaxed text-dim md:block">
        {db}
      </p>
    </nav>
  );
}
