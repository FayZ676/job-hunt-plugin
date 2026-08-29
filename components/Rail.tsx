import { ORDER, reading, type Stage } from "./status";

const FILL: Record<Stage, string> = {
  waiting: "bg-signal",
  live: "bg-base-content",
  closed: "bg-base-300",
};

const TRIAGED_OUT = "skipped";

export type Tally = { status: string; n: number };

export default function Rail({ tallies }: { tallies: Tally[] }) {
  const counted = ORDER
    .map((status) => ({ status, n: tallies.find((t) => t.status === status)?.n ?? 0 }))
    .filter((entry) => entry.n > 0);

  const charted = counted.filter((entry) => entry.status !== TRIAGED_OUT);
  const open = charted.reduce((sum, entry) => sum + entry.n, 0);
  const skipped = counted.find((entry) => entry.status === TRIAGED_OUT)?.n ?? 0;
  if (open + skipped === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex h-2 w-full gap-px overflow-hidden rounded-selector bg-base-300">
        {charted.map(({ status, n }) => {
          const { label, stage } = reading(status);
          return (
            <div
              key={status}
              className={`${FILL[stage]} min-w-0.5`}
              style={{ width: `${(n / open) * 100}%` }}
              title={`${n} ${label}`}
            />
          );
        })}
      </div>
      <p className="sr-only">
        Of {open + skipped} openings seen, {skipped} were skipped in triage.
        The bar covers the remaining {open}.
      </p>

      <dl className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
        {charted.map(({ status, n }) => {
          const { label, stage } = reading(status);
          return (
            <div key={status} className="flex items-baseline gap-1.5">
              <dt className="sr-only">{label}</dt>
              <dd className={`tnum font-mono text-sm ${
                stage === "closed" ? "text-soft" : "font-semibold text-base-content"}`}>
                {n}
              </dd>
              <span aria-hidden
                    className={`size-1.5 shrink-0 self-center rounded-full ${FILL[stage]}`} />
              <span className={`text-xs ${stage === "closed" ? "text-soft" : "text-base-content"}`}>
                {label}
              </span>
            </div>
          );
        })}

        <div className="flex items-baseline gap-1.5 border-l border-base-300 pl-5">
          <dt className="sr-only">skipped in triage</dt>
          <dd className="tnum font-mono text-sm text-soft">{skipped}</dd>
          <span className="text-xs text-soft">skipped in triage</span>
        </div>
      </dl>
    </div>
  );
}
