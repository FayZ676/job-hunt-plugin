"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import Menu from "./Menu";
import { Options, useRightClick, type Option } from "./Options";
import { Empty, Mark } from "./ui";

export type Keep = "roomy" | "wide";

export type LedgerColumn = {
  label: string;
  width?: string;
  numeric?: boolean;
  keep?: Keep;
  sortable?: boolean;
  filter?: ReactNode;
};

export type Sorted = { label: string; dir: "asc" | "desc" };

export type LedgerRow = {
  key: string;
  href?: string;
  mark?: boolean;
  cells: ReactNode[];
  action?: ReactNode;
  menu?: Option[];
};

const KEEP: Record<Keep, string> = {
  roomy: "hidden @2xl:table-cell",
  wide: "hidden @5xl:table-cell",
};

const kept = (keep?: Keep) => (keep ? KEEP[keep] : "");

const HEAD = "eyebrow whitespace-nowrap py-2 pl-3 pr-1 text-left font-medium";
const SLIM = "eyebrow whitespace-nowrap py-2 text-left font-medium";

const WAYS: { key: Sorted["dir"]; label: string; icon: ReactNode }[] = [
  { key: "asc", label: "Ascending", icon: <ArrowUp className="size-3" /> },
  { key: "desc", label: "Descending", icon: <ArrowDown className="size-3" /> },
];

export default function Ledger({
  head,
  rows,
  empty = "Nothing here yet.",
  foot,
  action,
  headless,
  sorted,
  onSort,
}: {
  head: LedgerColumn[];
  rows: LedgerRow[];
  empty?: ReactNode;
  foot?: ReactNode;
  action?: boolean;
  headless?: boolean;
  sorted?: Sorted | null;
  onSort?: (label: string, dir: Sorted["dir"] | null) => void;
}) {
  const router = useRouter();
  const { held, open, close } = useRightClick<string>();
  const marked = rows.some((row) => row.mark !== undefined);
  const span = (marked ? 2 : 1) + head.length + (action ? 1 : 0);

  const follow = (href: string) => (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
    if (!window.getSelection()?.isCollapsed) return;
    router.push(href);
  };

  const shown = rows.find((row) => row.key === held?.key);

  const raise = (event: MouseEvent<HTMLTableRowElement>, key: string) => {
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
    open(key, event);
  };

  return (
    <div className="@container overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="w-full text-sm">
        <colgroup>
          {marked && <col className="w-5" />}
          {head.map((column) => (
            <col key={column.label} style={{ width: column.width }} />
          ))}
          {action && <col className="w-9" />}
        </colgroup>

        {!headless && (
          <thead>
            <tr className="border-b border-base-300">
              {marked && (
                <th scope="col" className={`${SLIM} pl-3`}>
                  <span className="sr-only">Waiting on you</span>
                </th>
              )}
              {head.map((column) => {
                const on = sorted?.label === column.label;
                return (
                  <th
                    key={column.label}
                    scope="col"
                    aria-sort={on ? (sorted!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`group/head ${HEAD} ${kept(column.keep)}`}
                  >
                    <div className="flex items-center gap-0.5">
                      <span
                        className={`flex-1 transition-colors group-hover/head:text-base-content
                        ${on ? "text-base-content" : ""}`}
                      >
                        {column.label}
                      </span>
                      {column.sortable && onSort && (
                        <Menu
                          legend={`Sort by ${column.label}`}
                          icon={
                            on ? (
                              sorted!.dir === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3" />
                            )
                          }
                          choices={WAYS}
                          picked={on ? sorted!.dir : null}
                          onPick={(dir) => onSort(column.label, dir as Sorted["dir"] | null)}
                        />
                      )}
                      {column.filter}
                    </div>
                  </th>
                );
              })}
              {action && (
                <th scope="col" className={HEAD}>
                  <span className="sr-only">Delete</span>
                </th>
              )}
            </tr>
          </thead>
        )}

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={span}>
                <Empty>{empty}</Empty>
              </td>
            </tr>
          )}

          {rows.map((row) => (
            <tr
              key={row.key}
              onClick={row.href ? follow(row.href) : undefined}
              onContextMenu={row.menu?.length ? (event) => raise(event, row.key) : undefined}
              className={`ledgerrow group/row border-b border-base-200 last:border-0
                  ${row.href ? "cursor-pointer transition-colors hover:bg-base-200" : ""}
                  ${held?.key === row.key ? "bg-base-200" : ""}`}
            >
              {marked && (
                <td className="py-2.5 pl-3 pr-0 align-top">
                  <span className="flex h-5 items-center">
                    <Mark on={row.mark} />
                  </span>
                </td>
              )}

              {row.cells.map((cell, index) => (
                <td
                  key={head[index].label}
                  className={`py-2.5 px-3 align-top
                      ${head[index].numeric ? "tnum" : ""}
                      ${kept(head[index].keep)}`}
                >
                  {cell}
                </td>
              ))}

              {action && (
                <td className="py-2.5 px-3 align-top">
                  <span
                    className="flex h-5 items-center justify-end opacity-0 transition-opacity
                    group-hover/row:opacity-100 group-focus-within/row:opacity-100"
                  >
                    {row.action}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>

        {foot && (
          <tfoot>
            <tr className="border-t border-base-300">
              <td colSpan={span}>{foot}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {shown?.menu && <Options at={held!.at} options={shown.menu} onClose={close} />}
    </div>
  );
}
