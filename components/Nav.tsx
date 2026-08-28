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
    <nav className="border-b border-base-300 bg-base-100 p-3 md:sticky md:top-0 md:h-screen
      md:w-52 md:shrink-0 md:border-b-0 md:border-r md:py-6">
      <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-60">Job</p>
      <ul className="menu menu-horizontal w-full gap-1 md:menu-vertical">
        {LINKS.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className={here.startsWith(href) ? "menu-active" : ""}>{label}</Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 hidden break-all px-2 font-mono text-[10px] leading-relaxed opacity-60 md:block">
        {db}
      </p>
    </nav>
  );
}
