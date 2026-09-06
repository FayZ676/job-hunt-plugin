"use client";

import Ledger from "@/components/Ledger";
import Adder from "./Adder";
import DeleteButton from "./DeleteButton";
import Field from "./Field";
import { title, type Column } from "./columns";

export type Record_ = { rowid: number } & { [column: string]: unknown };

const unanswered = (row: Record_, columns: Column[]) => columns.some((column) => column.required && !row[column.name]);

export default function RecordList({
  table,
  columns,
  rows,
  seed,
  what = "this row",
  addLabel,
  empty,
  headless,
}: {
  table: string;
  columns: Column[];
  rows: Record_[];
  seed?: Record<string, string>;
  what?: string;
  addLabel?: string;
  empty?: string;
  headless?: boolean;
}) {
  return (
    <Ledger
      headless={headless}
      action
      empty={empty}
      head={columns.map((column) => ({ label: title(column), width: column.width }))}
      foot={<Adder table={table} columns={columns} seed={seed} label={addLabel ?? "Add"} />}
      rows={rows.map((row) => ({
        key: String(row.rowid),
        mark: unanswered(row, columns),
        action: <DeleteButton table={table} rowid={row.rowid} what={what} />,
        cells: columns.map((column) => (
          <Field
            key={column.name}
            table={table}
            rowid={row.rowid}
            column={column}
            value={row[column.name] as string | number | null}
          />
        )),
      }))}
    />
  );
}
