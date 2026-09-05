"use client";

import { useState, type ReactNode } from "react";
import Ledger, { type LedgerColumn, type Sorted } from "./Ledger";
import { Filter } from "lucide-react";
import Menu, { type Choice } from "./Menu";
import { Button } from "./ui";

export type FacetGroup = { name: string; column: string; legend?: string; facets: Choice[] };
export type FilterRow = {
  key: string;
  href?: string;
  mark?: boolean;
  facets: string[];
  haystack: string;
  cells: ReactNode[];
  sort?: (string | number | null | undefined)[];
};

const PAGE = 10;

function compare(left: string | number | null | undefined, right: string | number | null | undefined) {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

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
  const [sorted, setSorted] = useState<Sorted | null>(null);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      groups.every(({ name }) => !picked[name] || row.facets.includes(picked[name]!)) &&
      (!needle || row.haystack.toLowerCase().includes(needle)),
  );

  const column = sorted ? head.findIndex((one) => one.label === sorted.label) : -1;
  if (column >= 0) {
    const way = sorted!.dir === "asc" ? 1 : -1;
    shown.sort((left, right) => way * compare(left.sort?.[column], right.sort?.[column]));
  }

  const sort = (label: string, dir: Sorted["dir"] | null) => {
    setSorted(dir && { label, dir });
    setPage(0);
  };

  const columns = head.map((one) => {
    const group = groups.find((each) => each.column === one.label);
    return group
      ? {
          ...one,
          filter: (
            <Menu
              legend={group.legend ?? `Filter by ${group.name}`}
              icon={<Filter className={`size-3 ${picked[group.name] ? "fill-current" : ""}`} />}
              choices={group.facets}
              picked={picked[group.name] ?? null}
              onPick={(key) => {
                setPicked({ ...picked, [group.name]: key });
                setPage(0);
              }}
            />
          ),
        }
      : one;
  });

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const here = Math.min(page, pages - 1);
  const narrowed = needle !== "" || groups.some(({ name }) => picked[name]);

  return (
    <div className="space-y-4">
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

      <Ledger
        head={columns}
        sorted={sorted}
        onSort={sort}
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
