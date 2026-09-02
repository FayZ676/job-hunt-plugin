"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { Empty, Mark } from "./ui";

export type LedgerColumn = {
  label: string;
  width?: string;
  numeric?: boolean;
  hideNarrow?: boolean;
};

export type LedgerRow = {
  key: string;
  href?: string;
  mark?: boolean;
  cells: ReactNode[];
  handle?: ReactNode;
  action?: ReactNode;
  zone?: Record<string, unknown>;
};

const HEAD = "eyebrow whitespace-nowrap px-3 py-2 text-left font-medium";
const SLIM = "eyebrow whitespace-nowrap py-2 text-left font-medium";

export default function Ledger({
  head,
  rows,
  empty = "Nothing here yet.",
  foot,
  grip,
  action,
  dense,
  headless,
}: {
  head: LedgerColumn[];
  rows: LedgerRow[];
  empty?: ReactNode;
  foot?: ReactNode;
  grip?: boolean;
  action?: boolean;
  dense?: boolean;
  headless?: boolean;
}) {
  const router = useRouter();
  const pad = dense ? "py-1" : "py-2.5";
  const span = 2 + head.length + (grip ? 1 : 0) + (action ? 1 : 0);

  const follow = (href: string) => (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
    if (!window.getSelection()?.isCollapsed) return;
    router.push(href);
  };

  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="w-full text-sm">
        <colgroup>
          <col className="w-5" />
          {grip && <col className="w-6" />}
          {head.map((column) => (
            <col key={column.label} style={{ width: column.width }} />
          ))}
          {action && <col className="w-9" />}
        </colgroup>

        {!headless && (
          <thead>
            <tr className="border-b border-base-300">
              <th scope="col" className={`${SLIM} pl-3`}>
                <span className="sr-only">Waiting on you</span>
              </th>
              {grip && (
                <th scope="col" className={`${SLIM} px-1`}>
                  <span className="sr-only">Order</span>
                </th>
              )}
              {head.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`${HEAD} ${column.hideNarrow ? "hidden md:table-cell" : ""}`}
                >
                  {column.label}
                </th>
              ))}
              {action && (
                <th scope="col" className={HEAD}>
                  <span className="sr-only">Remove</span>
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
              {...row.zone}
              onClick={row.href ? follow(row.href) : undefined}
              className={`ledgerrow group/row border-b border-base-200 last:border-0
                  ${row.href ? "cursor-pointer transition-colors hover:bg-base-200" : ""}`}
            >
              <td className={`${pad} pl-3 pr-0 align-top`}>
                <span className="flex h-5 items-center">
                  <Mark on={row.mark} />
                </span>
              </td>

              {grip && (
                <td className={`${pad} px-1 align-top`}>
                  <span className="flex h-5 items-center">{row.handle}</span>
                </td>
              )}

              {row.cells.map((cell, index) => (
                <td
                  key={head[index].label}
                  className={`${pad} px-3 align-top
                      ${head[index].numeric ? "tnum" : ""}
                      ${head[index].hideNarrow ? "hidden md:table-cell" : ""}`}
                >
                  {index === 0 && row.href ? (
                    <Link href={row.href} className="block hover:underline">
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </td>
              ))}

              {action && (
                <td className={`${pad} px-3 align-top`}>
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
    </div>
  );
}
