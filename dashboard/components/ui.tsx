import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import Glyph from "./Glyph";
import { label, reading } from "./status";

export const Section = ({
  title,
  sub,
  children,
  aside,
}: {
  title?: string;
  sub?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) => (
  <section className="mb-8">
    {(title || sub || aside) && (
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          {title && <h2 className="eyebrow">{title}</h2>}
          {sub && <p className="mt-0.5 max-w-2xl text-xs text-soft">{sub}</p>}
        </div>
        {aside}
      </div>
    )}
    {children}
  </section>
);

export const Split = ({ children, rail, pinned }: { children: ReactNode; rail?: ReactNode; pinned?: boolean }) => (
  <div className="@container">
    <div
      className="grid items-start gap-x-6 gap-y-8 @5xl:grid-cols-[minmax(0,1fr)_28rem]
      [&>div>section]:mb-0"
    >
      <div className="order-2 flex min-w-0 flex-col gap-8 @5xl:order-1">{children}</div>
      {rail && (
        <div
          className={`order-1 flex flex-col gap-8 @5xl:order-2
          ${pinned ? "@5xl:sticky @5xl:top-6" : ""}`}
        >
          {rail}
        </div>
      )}
    </div>
  </div>
);

export const Card = ({
  children,
  readout,
  className = "",
}: {
  children: ReactNode;
  readout?: boolean;
  className?: string;
}) => (
  <div
    className={`${
      readout ? "border-y border-base-300 py-4" : "rounded-box border border-base-300 bg-base-100 p-4 md:p-5"
    } ${className}`}
  >
    {children}
  </div>
);

const TONES = {
  quiet: "border border-base-300 hover:border-base-content disabled:hover:border-base-300",
  firm: `border border-base-content bg-base-content text-base-100
    hover:border-base-content/85 hover:bg-base-content/85`,
  grave: "border border-error/40 text-error hover:border-error hover:bg-error hover:text-error-content",
};

export const Button = ({
  tone = "quiet",
  icon,
  children,
  className = "",
  ...rest
}: { tone?: "quiet" | "firm" | "grave"; icon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...rest}
    className={`rounded-field px-2.5 py-1 text-xs transition-colors disabled:opacity-40
      ${icon ? "inline-flex items-center gap-1.5" : ""}
      ${TONES[tone]} ${className}`}
  >
    {icon}
    {children}
  </button>
);

const GHOST_TONES = {
  quiet: "text-soft hover:text-base-content",
  grave: "text-error hover:bg-error hover:text-error-content",
};

export const Ghost = ({
  tone = "quiet",
  icon,
  tight,
  children,
  className = "",
  ...rest
}: {
  tone?: "quiet" | "grave";
  icon?: ReactNode;
  tight?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...rest}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-field
      transition-colors hover:bg-base-200 disabled:opacity-40
      ${tight ? "px-1 leading-none" : children ? "px-2 py-1.5" : "p-1.5"}
      ${GHOST_TONES[tone]} ${className}`}
  >
    {icon}
    {children}
  </button>
);

const ROW_TONES = {
  quiet: "hover:bg-base-200",
  grave: "text-error hover:bg-error hover:text-error-content",
};

export const Row = ({
  tone = "quiet",
  roomy,
  on,
  children,
  className = "",
  ...rest
}: {
  tone?: "quiet" | "grave";
  roomy?: boolean;
  on?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...rest}
    className={`w-full rounded-field text-left transition-colors disabled:opacity-40
      ${roomy ? "px-3 py-2 text-sm" : "px-3 py-1.5 text-xs"}
      ${ROW_TONES[tone]} ${on ? "bg-base-200" : ""} ${className}`}
  >
    {children}
  </button>
);

export const confirmDelete = (what: string) => confirm(`Delete ${what}? This cannot be undone.`);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="px-3 py-2.5 text-sm text-soft">{children}</p>
);

export const Prose = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${className}`}>{children}</div>
);

export const Mark = ({ on }: { on?: boolean }) => (
  <span
    aria-hidden
    className={`inline-block size-1.5 shrink-0 rounded-full
          ${on ? "bg-signal" : "bg-transparent"}`}
  />
);

const STAGE_TEXT: Record<string, string> = {
  waiting: "font-medium text-base-content",
  live: "text-base-content",
  closed: "text-soft",
};

export const Badge = ({ children }: { children: string | null | undefined }) => {
  if (!children) return null;
  const { stage, icon } = reading(children);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs
      ${STAGE_TEXT[stage]}`}
    >
      <Glyph icon={icon} className={stage === "waiting" ? "text-signal" : ""} />
      {label(children)}
    </span>
  );
};

export const fitTone = (value: number | null) =>
  value === null
    ? "text-soft"
    : value >= 7
      ? "font-semibold text-base-content"
      : value >= 4
        ? "text-base-content"
        : "text-soft";

export const Score = ({ value, why }: { value: number | null; why?: string | null }) => {
  const mark = <span className={`tnum font-mono text-sm ${fitTone(value)}`}>{value ?? "—"}</span>;

  if (!why) return mark;

  return (
    <span data-tip={why} className="tooltip tooltip-loose tooltip-bottom cursor-help [&:before]:text-left">
      {mark}
    </span>
  );
};

export const Stamp = ({ children }: { children: ReactNode }) => (
  <span className="tnum whitespace-nowrap font-mono text-xs text-soft">{children}</span>
);

export const Out = ({ href, children }: { href: string | null; children?: ReactNode }) =>
  href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-base-300 underline-offset-2 hover:decoration-current"
    >
      {children ?? href}
    </a>
  ) : (
    <span className="text-soft">—</span>
  );

export type Note = { label: ReactNode; value: ReactNode; mark?: boolean };
export type Band = { label?: string; note?: string; notes: (Note | false | null | undefined)[] };

const kept = (notes: Band["notes"]) => notes.filter((note): note is Note => Boolean(note));

const BandHead = ({ label, note, lead }: { label: string; note?: string; lead?: boolean }) => (
  <div
    className={`flex flex-wrap items-baseline justify-between gap-x-4 border-y border-base-300
    px-3 py-2 ${lead ? "border-t-0" : ""}`}
  >
    <h3 className="eyebrow">{label}</h3>
    {note && <p className="text-xs text-soft">{note}</p>}
  </div>
);

export const Sheet = ({
  bands,
  flush,
  readout,
  label,
}: {
  bands: (Band | false | null | undefined)[];
  flush?: boolean;
  readout?: boolean;
  label?: string;
}) => {
  const shown = bands.filter((band): band is Band => Boolean(band));
  const marked = shown.some((band) => kept(band.notes).some((note) => note.mark !== undefined));
  return (
    <div
      style={label ? ({ "--label": label } as CSSProperties) : undefined}
      className={
        flush
          ? ""
          : readout
            ? "border-y border-base-300"
            : "overflow-hidden rounded-box border border-base-300 bg-base-100"
      }
    >
      {shown.map((band, place) => (
        <section key={band.label ?? place}>
          {band.label && <BandHead label={band.label} note={band.note} lead={place === 0} />}
          <dl className="divide-y divide-base-200">
            {kept(band.notes).map((note, index) => (
              <div key={index} className={`sheetrow py-1.5 ${readout ? "" : "px-3"}`}>
                <dt className="flex items-baseline gap-1.5 py-1 text-sm text-soft">
                  {marked && (
                    <span className="self-center">
                      <Mark on={note.mark} />
                    </span>
                  )}
                  <span className="min-w-0">{note.label}</span>
                </dt>
                <dd className="min-w-0 break-words py-1 text-sm">{note.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
};

export const Stack = ({
  head,
  children,
  foot,
  className = "",
}: {
  head?: string;
  children: ReactNode;
  foot?: ReactNode;
  className?: string;
}) => (
  <div className={`overflow-hidden rounded-box border border-base-300 bg-base-100 ${className}`}>
    {head && <BandHead label={head} lead />}
    {children}
    {foot && <div className="border-t border-base-300">{foot}</div>}
  </div>
);

export const Disclosure = ({
  summary,
  aside,
  mark,
  children,
  className = "",
}: {
  summary: ReactNode;
  aside?: ReactNode;
  mark?: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <details className={`border-b border-base-200 last:border-0 ${className}`}>
    <summary
      className="flex cursor-pointer list-none items-baseline gap-2 px-3 py-2.5
      transition-colors hover:bg-base-200 [&::-webkit-details-marker]:hidden"
    >
      <span className="self-center">
        <Mark on={mark} />
      </span>
      <span aria-hidden className="twist shrink-0 text-soft">
        ›
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{summary}</span>
      {aside}
    </summary>
    <div className="px-3 pb-7 pt-3 sm:pl-[calc(0.75rem+1.5rem)]">{children}</div>
  </details>
);
