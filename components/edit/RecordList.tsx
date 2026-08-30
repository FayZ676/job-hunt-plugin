"use client";

import FieldRow, { tracks } from "./FieldRow";
import Adder from "./Adder";
import { useReorder } from "./reorder";
import { title, type Column } from "./columns";

export type Record_ = { rowid: number } & { [column: string]: unknown };

export default function RecordList({
  table, columns, rows, seed, what = "this row", addLabel, empty, ordered,
}: {
  table: string;
  columns: Column[];
  rows: Record_[];
  seed?: Record<string, string>;
  what?: string;
  addLabel?: string;
  empty?: string;
  ordered?: boolean;
}) {
  const { Grip, dropzone } = useReorder(table, rows);

  return (
    <div className="space-y-2">
      {rows.length > 0 && !ordered && (
        <div className="rowgrid hidden px-1 md:!grid" style={tracks(columns)}>
          {columns.map((column) => (
            <span key={column.name} className="eyebrow">{title(column)}</span>
          ))}
          <span className="w-8" />
        </div>
      )}

      {rows.map((row, place) => {
        const line = (
          <FieldRow key={row.rowid} table={table} rowid={row.rowid} columns={columns}
                    values={row} what={what} labelled={false} />
        );
        if (!ordered) return line;
        return (
          <div key={row.rowid} {...dropzone(place)} className="flex items-center gap-1 rounded-box">
            <Grip place={place} what={what} />
            <div className="min-w-0 grow">{line}</div>
          </div>
        );
      })}

      {rows.length === 0 && empty && <p className="py-1 text-sm text-soft">{empty}</p>}
      <Adder table={table} columns={columns} seed={seed} label={addLabel ?? "Add"} />
    </div>
  );
}
