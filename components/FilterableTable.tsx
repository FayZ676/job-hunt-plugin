"use client";

import { useState, type ReactNode } from "react";
import Ledger, { type LedgerColumn } from "./Ledger";
import { Button } from "./ui";

export type Facet = {
  key: string;
  label: string;
  count: number;
  quiet?: boolean;
  icon?: ReactNode;
};
export type FacetGroup = { name: string; legend?: string; facets: Facet[] };
export type FilterRow = {
  key: string;
  href?: string;
  mark?: boolean;
  facets: string[];
  haystack: string;
  cells: ReactNode[];
};

const PAGE = 15;

export default function FilterableTable({
  head,
  rows,
  groups = [],
  placeholder,
  empty,
}: {
  head: LedgerColumn[];
  rows: FilterRow[];
  groups?: FacetGroup[];
  placeholder: string;
  empty?: string;
}) {
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      groups.every(({ name }) => !picked[name] || row.facets.includes(picked[name]!)) &&
      (!needle || row.haystack.toLowerCase().includes(needle)),
  );

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const here = Math.min(page, pages - 1);
  const narrowed = needle !== "" || groups.some(({ name }) => picked[name]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <input
          type="search"
          aria-label={`Search ${placeholder}`}
          className="w-full rounded-field border border-base-300 bg-base-100 px-3 py-1.5 text-sm
            placeholder:text-soft md:w-72"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />

        {groups.map((group) => (
          <fieldset key={group.name} className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">{group.legend ?? `Filter by ${group.name}`}</legend>
            {group.facets.map((facet) => {
              const on = picked[group.name] === facet.key;
              return (
                <button
                  key={facet.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setPicked({ ...picked, [group.name]: on ? null : facet.key });
                    setPage(0);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-field border px-2 py-1
                    text-xs transition-colors ${
                      on
                        ? "border-base-content bg-base-content text-base-100"
                        : facet.quiet
                          ? "border-base-300 text-soft hover:border-base-content hover:text-base-content"
                          : "border-base-300 text-base-content hover:border-base-content"
                    }`}
                >
                  {facet.icon}
                  {facet.label}
                  <span className={`tnum font-mono ${on ? "opacity-70" : "text-soft"}`}>{facet.count}</span>
                </button>
              );
            })}
          </fieldset>
        ))}
      </div>

      <Ledger
        head={head}
        rows={shown.slice(here * PAGE, here * PAGE + PAGE)}
        empty={narrowed ? "Nothing matches that. Clear the search and filters to see the rest." : empty}
      />

      {pages > 1 && (
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <Button disabled={here === 0} onClick={() => setPage(here - 1)}>
              Previous
            </Button>
            <Button disabled={here === pages - 1} onClick={() => setPage(here + 1)}>
              Next
            </Button>
          </div>
          <p aria-live="polite" className="tnum text-xs text-soft">
            Page {here + 1} of {pages} · showing {shown.length} of {rows.length}
          </p>
        </div>
      )}
    </div>
  );
}
