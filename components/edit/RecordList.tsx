"use client";

import FieldRow, { tracks } from "./FieldRow";
import Adder from "./Adder";
import { title, type Column } from "./columns";

export type Record_ = { rowid: number } & { [column: string]: unknown };

export default function RecordList({
  table, columns, rows, seed, what = "this row", addLabel, empty,
}: {
  table: string;
  columns: Column[];
  rows: Record_[];
  seed?: Record<string, string>;
  what?: string;
  addLabel?: string;
  empty?: string;
}) {
  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="rowgrid hidden px-1 md:!grid" style={tracks(columns)}>
          {columns.map((column) => (
            <span key={column.name} className="eyebrow">{title(column)}</span>
          ))}
          <span className="w-8" />
        </div>
      )}

      {rows.map((row) => (
        <FieldRow key={row.rowid} table={table} rowid={row.rowid} columns={columns}
                  values={row} what={what} labelled={false} />
      ))}

      {rows.length === 0 && empty && <p className="py-1 text-sm text-soft">{empty}</p>}
      <Adder table={table} columns={columns} seed={seed} label={addLabel ?? "Add"} />
    </div>
  );
}
