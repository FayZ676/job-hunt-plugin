"use client";

import { useState, type ReactNode } from "react";
import { DataTable } from "./ui";

export type Facet = { key: string; label: string; count: number };
export type FacetGroup = { name: string; facets: Facet[] };
export type FilterRow = {
  key: string;
  href?: string;
  facets: string[];
  haystack: string;
  cells: ReactNode[];
};

const PAGE = 15;

export default function FilterableTable({
  head, rows, groups = [], placeholder, empty,
}: {
  head: { label: string; hideNarrow?: boolean }[];
  rows: FilterRow[];
  groups?: FacetGroup[];
  placeholder: string;
  empty?: string;
}) {
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter((row) =>
    groups.every(({ name }) => !picked[name] || row.facets.includes(picked[name]!)) &&
    (!needle || row.haystack.toLowerCase().includes(needle)));

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const here = Math.min(page, pages - 1);

  return (
    <div className="space-y-4">
      <input
        type="search"
        className="input input-sm w-full md:w-80"
        placeholder={placeholder}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setPage(0); }}
      />

      {groups.map((group) => (
        <div key={group.name} className="flex flex-wrap gap-1.5">
          {group.facets.map((facet) => {
            const on = picked[group.name] === facet.key;
            return (
              <button
                key={facet.key}
                type="button"
                onClick={() => {
                  setPicked({ ...picked, [group.name]: on ? null : facet.key });
                  setPage(0);
                }}
                className={`btn btn-xs ${on ? "btn-primary" : "btn-outline"}`}
              >
                {facet.label}
                <span className="opacity-60">{facet.count}</span>
              </button>
            );
          })}
        </div>
      ))}

      <DataTable head={head} rows={shown.slice(here * PAGE, here * PAGE + PAGE)} empty={empty} />

      {pages > 1 && (
        <div className="flex items-center gap-3 text-xs opacity-60">
          <div className="join">
            <button type="button" className="btn btn-xs join-item" disabled={here === 0}
                    onClick={() => setPage(here - 1)}>‹ Prev</button>
            <button type="button" className="btn btn-xs join-item" disabled={here === pages - 1}
                    onClick={() => setPage(here + 1)}>Next ›</button>
          </div>
          <span>Page {here + 1} of {pages} · {shown.length} total</span>
        </div>
      )}
    </div>
  );
}
