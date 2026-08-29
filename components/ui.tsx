import Link from "next/link";
import type { ReactNode } from "react";
import { reading } from "./status";

export const PageHeader = ({ title, sub, children }:
  { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <header className="mb-6">
    <h1 className="font-display text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
    {sub && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-soft">{sub}</p>}
    {children}
  </header>
);

export const ScreenHead = ({ kicker, headline, children }:
  { kicker: string; headline: ReactNode; children?: ReactNode }) => (
  <header className="mb-6">
    <p className="eyebrow">{kicker}</p>
    <p className="mt-2 max-w-3xl font-display text-xl font-medium leading-snug md:text-2xl">
      {headline}
    </p>
    {children}
  </header>
);

export const Section = ({ title, sub, children, aside }:
  { title?: string; sub?: ReactNode; children: ReactNode; aside?: ReactNode }) => (
  <section className="mb-9">
    {(title || sub || aside) && (
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          {title && <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>}
          {sub && <p className="mt-0.5 text-sm text-soft">{sub}</p>}
        </div>
        {aside}
      </div>
    )}
    {children}
  </section>
);

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-box border border-base-300 bg-base-100 p-4 md:p-5 ${className}`}>
    {children}
  </div>
);

export const Label = ({ children }: { children: ReactNode }) => (
  <h3 className="eyebrow mb-2">{children}</h3>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-6 text-sm text-soft">{children}</p>
);

export const Prose = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${className}`}>
    {children}
  </div>
);

const STAGE_MARK: Record<string, string> = {
  waiting: "bg-signal",
  live: "bg-base-content",
  closed: "bg-base-300",
};

const STAGE_TEXT: Record<string, string> = {
  waiting: "font-medium text-base-content",
  live: "text-base-content",
  closed: "text-soft",
};

export const Badge = ({ children }: { children: string | null | undefined }) => {
  if (!children) return null;
  const { label, stage } = reading(children);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${STAGE_TEXT[stage]}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${STAGE_MARK[stage]}`} />
      {label}
    </span>
  );
};

export const Score = ({ value }: { value: number | null }) => (
  <span className={`tnum font-mono text-sm ${
    value === null ? "text-soft"
      : value >= 7 ? "font-semibold text-base-content"
      : value >= 4 ? "text-base-content"
      : "text-soft"}`}>
    {value ?? "—"}
  </span>
);

export const Stamp = ({ children }: { children: ReactNode }) => (
  <span className="tnum whitespace-nowrap font-mono text-xs text-soft">{children}</span>
);

export const Out = ({ href, children }: { href: string | null; children?: ReactNode }) =>
  href ? (
    <a href={href} target="_blank" rel="noreferrer"
       className="underline decoration-base-300 underline-offset-2 hover:decoration-current">
      {children ?? href}
    </a>
  ) : <span className="text-soft">—</span>;

export const DataTable = ({ head, rows, empty = "Nothing here yet." }: {
  head: { label: string; hideNarrow?: boolean; numeric?: boolean }[];
  rows: { key: string; href?: string; cells: ReactNode[] }[];
  empty?: string;
}) => rows.length === 0 ? <Empty>{empty}</Empty> : (
  <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-base-300">
          {head.map((column) => (
            <th key={column.label} scope="col"
                className={`eyebrow whitespace-nowrap px-3 py-2.5 text-left font-medium
                  ${column.hideNarrow ? "hidden md:table-cell" : ""}`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}
              className="border-b border-base-300 transition-colors last:border-0 hover:bg-base-200">
            {row.cells.map((cell, index) => (
              <td key={head[index].label}
                  className={`px-3 py-2.5 align-top
                    ${head[index].numeric ? "tnum" : ""}
                    ${head[index].hideNarrow ? "hidden md:table-cell" : ""}`}>
                {index === 0 && row.href
                  ? <Link href={row.href} className="block hover:underline">{cell}</Link>
                  : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

type Pair = [string, ReactNode];

export const DefList = ({ pairs }: { pairs: (Pair | false | null | undefined)[] }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
    {pairs.filter((pair): pair is Pair => Boolean(pair)).map(([label, node]) => (
      <div key={label} className="contents">
        <dt className="text-soft">{label}</dt>
        <dd className="mb-2 min-w-0 break-words sm:mb-0">{node}</dd>
      </div>
    ))}
  </dl>
);
