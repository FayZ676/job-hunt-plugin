import Field from "@/components/edit/Field";
import type { Field as Answer } from "@/lib/queries";

const VALUE = { name: "value", label: "answer", blocking: true } as const;
const TRACKS = { ["--tracks" as string]: "minmax(0,0.9fr) minmax(0,1.6fr)" };

export default function ProfileSection({ section, rows }: { section: string; rows: Answer[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.rowid} style={TRACKS}
             className="rowgrid items-center rounded-box bg-base-200 p-3 md:bg-transparent md:p-0">
          <label className="text-sm md:pt-2" htmlFor={`f${row.rowid}`}>
            {row.field.slice(section.length + 1).replace(/_/g, " ")}
            {row.value === null && <span className="ml-1.5 text-xs text-error">needs an answer</span>}
          </label>
          <Field table="profile" rowid={row.rowid} column={VALUE} value={row.value} />
        </div>
      ))}
    </div>
  );
}
