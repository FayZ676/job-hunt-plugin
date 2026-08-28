import Link from "next/link";
import type { ReactNode } from "react";

export const PageHeader = ({ title, sub, children }:
  { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <header className="mb-7">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    {sub && <p className="mt-1 max-w-2xl text-sm text-dim">{sub}</p>}
    {children}
  </header>
);

export const Section = ({ title, sub, children, aside }:
  { title: string; sub?: ReactNode; children: ReactNode; aside?: ReactNode }) => (
  <section className="mb-9">
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-dim">{sub}</p>}
      </div>
      {aside}
    </div>
    {children}
  </section>
);

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-line bg-panel p-4 md:p-5 ${className}`}>{children}</div>
);

export const Label = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim">{children}</h3>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-4 text-sm text-dim">{children}</p>
);

export const Prose = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${className}`}>{children}</div>
);

const TONE: Record<string, string> = {
  applied: "text-good border-good", interviewing: "text-good border-good",
  shortlisted: "text-accent border-accent", staged: "text-accent border-accent",
  rejected: "text-bad border-bad", blocked: "text-bad border-bad",
};

export const Badge = ({ children }: { children: string | null | undefined }) =>
  children ? (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] leading-4
      ${TONE[children] ?? "border-line text-dim"}`}>{children}</span>
  ) : null;

export const Score = ({ value }: { value: number | null }) => (
  <span className={`font-mono font-semibold ${
    value === null ? "text-dim" : value >= 7 ? "text-good" : value >= 4 ? "text-warn" : "text-dim"}`}>
    {value ?? "—"}
  </span>
);

export const Stamp = ({ children }: { children: ReactNode }) => (
  <span className="whitespace-nowrap font-mono text-xs text-dim">{children}</span>
);

export const Out = ({ href, children }: { href: string | null; children?: ReactNode }) =>
  href ? (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {children ?? href}
    </a>
  ) : <span className="text-dim">—</span>;

export const Meter = ({ done, total }: { done: number; total: number }) => (
  <div className="flex items-center gap-3">
    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-sunk">
      <div className="h-full rounded-full bg-accent transition-all"
           style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
    <span className="text-xs text-dim">{done} of {total} answered</span>
  </div>
);

export type Cell = { label: string; node: ReactNode; hideNarrow?: boolean };

export const DataTable = ({ head, rows, empty = "Nothing here yet." }: {
  head: { label: string; hideNarrow?: boolean }[];
  rows: { key: string; href?: string; cells: ReactNode[] }[];
  empty?: string;
}) => rows.length === 0 ? <Empty>{empty}</Empty> : (
  <div className="overflow-x-auto rounded-xl border border-line">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line bg-sunk">
          {head.map((column) => (
            <th key={column.label}
                className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider
                  text-dim ${column.hideNarrow ? "hidden md:table-cell" : ""}`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line last:border-0 hover:bg-sunk">
            {row.cells.map((cell, index) => (
              <td key={head[index].label}
                  className={`px-3 py-2 align-top ${head[index].hideNarrow ? "hidden md:table-cell" : ""}`}>
                {index === 0 && row.href
                  ? <Link href={row.href} className="block">{cell}</Link>
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
        <dt className="text-dim">{label}</dt>
        <dd className="mb-2 min-w-0 break-words sm:mb-0">{node}</dd>
      </div>
    ))}
  </dl>
);
