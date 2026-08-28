import Link from "next/link";
import type { ReactNode } from "react";

export const PageHeader = ({ title, sub, children }:
  { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <header className="mb-7">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    {sub && <p className="mt-1 max-w-2xl text-sm opacity-60">{sub}</p>}
    {children}
  </header>
);

export const Section = ({ title, sub, children, aside }:
  { title: string; sub?: ReactNode; children: ReactNode; aside?: ReactNode }) => (
  <section className="mb-9">
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm opacity-60">{sub}</p>}
      </div>
      {aside}
    </div>
    {children}
  </section>
);

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`card border border-base-300 bg-base-100 p-4 md:p-5 ${className}`}>{children}</div>
);

export const Label = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider opacity-60">{children}</h3>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-4 text-sm opacity-60">{children}</p>
);

export const Prose = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${className}`}>{children}</div>
);

const TONE: Record<string, string> = {
  applied: "badge-success", interviewing: "badge-success",
  shortlisted: "badge-primary", staged: "badge-primary",
  rejected: "badge-error", blocked: "badge-error",
};

export const Badge = ({ children }: { children: string | null | undefined }) =>
  children ? (
    <span className={`badge badge-sm badge-outline ${TONE[children] ?? "opacity-60"}`}>{children}</span>
  ) : null;

export const Score = ({ value }: { value: number | null }) => (
  <span className={`font-mono font-semibold ${
    value === null ? "opacity-60" : value >= 7 ? "text-success" : value >= 4 ? "text-warning" : "opacity-60"}`}>
    {value ?? "—"}
  </span>
);

export const Stamp = ({ children }: { children: ReactNode }) => (
  <span className="whitespace-nowrap font-mono text-xs opacity-60">{children}</span>
);

export const Out = ({ href, children }: { href: string | null; children?: ReactNode }) =>
  href ? (
    <a href={href} target="_blank" rel="noreferrer" className="link link-primary">{children ?? href}</a>
  ) : <span className="opacity-60">—</span>;

export const Meter = ({ done, total }: { done: number; total: number }) => (
  <div className="flex items-center gap-3">
    <progress className="progress progress-primary w-40" value={done} max={total || 1} />
    <span className="text-xs opacity-60">{done} of {total} answered</span>
  </div>
);

export const DataTable = ({ head, rows, empty = "Nothing here yet." }: {
  head: { label: string; hideNarrow?: boolean }[];
  rows: { key: string; href?: string; cells: ReactNode[] }[];
  empty?: string;
}) => rows.length === 0 ? <Empty>{empty}</Empty> : (
  <div className="overflow-x-auto rounded-box border border-base-300">
    <table className="table table-sm">
      <thead>
        <tr>
          {head.map((column) => (
            <th key={column.label} className={column.hideNarrow ? "hidden md:table-cell" : ""}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="hover:bg-base-200">
            {row.cells.map((cell, index) => (
              <td key={head[index].label}
                  className={`align-top ${head[index].hideNarrow ? "hidden md:table-cell" : ""}`}>
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
        <dt className="opacity-60">{label}</dt>
        <dd className="mb-2 min-w-0 break-words sm:mb-0">{node}</dd>
      </div>
    ))}
  </dl>
);
