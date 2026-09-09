"use client";

import { useState, type ReactNode } from "react";
import { Filter } from "lucide-react";
import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import Ledger, { type Keep, type LedgerColumn, type Sorted } from "./Ledger";
import Find from "./Find";
import Menu, { type Choice } from "./Menu";
import type { Option } from "./Options";
import { Button } from "./ui";

export const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  columnFacetingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

export type Look = {
  width?: string;
  numeric?: boolean;
  keep?: Keep;
  search?: boolean;
  facet?: { legend: string; order?: string[]; read: (key: string) => Omit<Choice, "key" | "count"> };
};

const PAGE = 10;

export default function DataTable<T extends RowData>({
  data,
  columns,
  empty,
  href,
  menu,
}: {
  data: T[];
  columns: ColumnDef<typeof features, T, any>[];
  empty?: string;
  href?: (row: T) => string;
  menu?: (row: T) => Option[];
}) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE });
  const table = useTable({
    features,
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    autoResetPageIndex: true,
  });

  const headers = table.getHeaderGroups()[0].headers;

  const head: LedgerColumn[] = headers.map(({ column }) => {
    const look = (column.columnDef.meta ?? {}) as Look;
    return {
      label: String(column.columnDef.header),
      width: look.width,
      numeric: look.numeric,
      keep: look.keep,
      sortable: column.getCanSort(),
      filter: look.search ? (
        <Find
          legend={`Search ${String(column.columnDef.header).toLowerCase()}`}
          value={(column.getFilterValue() as string) ?? ""}
          onChange={(value) => column.setFilterValue(value)}
        />
      ) : look.facet ? (
        <Menu
          legend={look.facet.legend}
          icon={<Filter className={`size-3 ${column.getFilterValue() ? "fill-current" : ""}`} />}
          choices={facets(column.getFacetedUniqueValues(), look.facet)}
          picked={(column.getFilterValue() as string) ?? null}
          onPick={(key) => column.setFilterValue(key ?? undefined)}
        />
      ) : undefined,
    };
  });

  const [lead] = table.state.sorting;
  const sorted: Sorted | null = lead
    ? { label: String(table.getColumn(lead.id)!.columnDef.header), dir: lead.desc ? "desc" : "asc" }
    : null;
  const onSort = (label: string, dir: Sorted["dir"] | null) => {
    const column = headers.find((header) => String(header.column.columnDef.header) === label)!.column;
    table.setSorting(dir ? [{ id: column.id, desc: dir === "desc" }] : []);
  };

  const pages = table.getPageCount();
  const narrowed = table.state.columnFilters.length > 0;

  return (
    <div className="space-y-4">
      <Ledger
        head={head}
        sorted={sorted}
        onSort={onSort}
        rows={table.getRowModel().rows.map((row) => ({
          key: row.id,
          href: href?.(row.original),
          menu: menu?.(row.original),
          cells: row.getAllCells().map((cell) => <table.FlexRender key={cell.id} cell={cell} />),
        }))}
        empty={narrowed ? "Nothing matches that. Clear the column filters to see the rest." : empty}
      />

      {pages > 1 && (
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <Button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              Previous
            </Button>
            <Button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              Next
            </Button>
          </div>
          <p aria-live="polite" className="tnum text-xs text-soft">
            Page {pagination.pageIndex + 1} of {pages} · showing {table.getFilteredRowModel().rows.length} of{" "}
            {data.length}
          </p>
        </div>
      )}
    </div>
  );
}

function facets(counts: Map<any, number>, facet: NonNullable<Look["facet"]>): Choice[] {
  const keys = [...counts.keys()].filter((key) => key != null && key !== "").map(String);
  const order = facet.order;
  if (order) keys.sort((left, right) => order.indexOf(left) - order.indexOf(right));
  return keys.map((key) => ({ key, count: counts.get(key), ...facet.read(key) }));
}
