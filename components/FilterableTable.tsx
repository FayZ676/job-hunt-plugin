"use client";

import { useState, type ReactNode } from "react";
import Ledger, { type LedgerColumn, type Sorted } from "./Ledger";
import { Filter } from "lucide-react";
import Find from "./Find";
import Menu, { type Choice } from "./Menu";
import { Button } from "./ui";

export type FacetGroup = { name: string; column: string; legend?: string; facets: Choice[] };
export type FilterRow = {
  key: string;
  href?: string;
  mark?: boolean;
  facets: string[];
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
  empty,
}: {
  head: LedgerColumn[];
  rows: FilterRow[];
  groups?: FacetGroup[];
  empty?: string;
}) {
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [hunted, setHunted] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [sorted, setSorted] = useState<Sorted | null>(null);

  const needles = head
    .map((one, index) => ({ index, needle: (hunted[one.label] ?? "").trim().toLowerCase() }))
    .filter(({ needle }) => needle !== "");

  const shown = rows.filter(
    (row) =>
      groups.every(({ name }) => !picked[name] || row.facets.includes(picked[name]!)) &&
      needles.every(({ index, needle }) =>
        String(row.sort?.[index] ?? "")
          .toLowerCase()
          .includes(needle),
      ),
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
    if (one.searchable)
      return {
        ...one,
        filter: (
          <Find
            legend={`Search ${one.label.toLowerCase()}`}
            value={hunted[one.label] ?? ""}
            onChange={(value) => {
              setHunted({ ...hunted, [one.label]: value });
              setPage(0);
            }}
          />
        ),
      };
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
  const narrowed = needles.length > 0 || groups.some(({ name }) => picked[name]);

  return (
    <div className="space-y-4">
      <Ledger
        head={columns}
        sorted={sorted}
        onSort={sort}
        rows={shown.slice(here * PAGE, here * PAGE + PAGE)}
        empty={narrowed ? "Nothing matches that. Clear the column filters to see the rest." : empty}
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
