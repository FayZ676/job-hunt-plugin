"use client";

import DeleteButton from "./DeleteButton";
import Field from "./Field";
import { title, type Column } from "./columns";

export const tracks = (columns: Column[], trailing = " auto") => ({
  ["--tracks" as string]: columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ") + trailing,
});

export default function FieldRow({
  table, rowid, columns, values, what, stack, onDelete = true, labelled = true,
}: {
  table: string;
  rowid: number;
  columns: Column[];
  values: Record<string, unknown>;
  what?: string;
  stack?: boolean;
  onDelete?: boolean;
  labelled?: boolean;
}) {
  return (
    <div
      className={stack ? "space-y-3" : "rowgrid rounded-box bg-base-200 p-3 md:bg-transparent md:p-0"}
      style={stack ? undefined : tracks(columns)}
    >
      {columns.map((column) => (
        <div key={column.name}>
          <span className={`eyebrow mb-1 block ${labelled || stack ? "" : "md:hidden"}`}>
            {title(column)}
          </span>
          <Field table={table} rowid={rowid} column={column}
                 value={values[column.name] as string | number | null} />
        </div>
      ))}
      {onDelete && !stack && (
        <div className={`flex justify-end md:block ${labelled ? "md:pt-5" : ""}`}>
          <DeleteButton table={table} rowid={rowid} what={what} />
        </div>
      )}
    </div>
  );
}
