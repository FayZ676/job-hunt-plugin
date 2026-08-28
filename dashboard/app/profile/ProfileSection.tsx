"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/actions";
import DeleteButton from "@/components/edit/DeleteButton";
import Field from "@/components/edit/Field";
import { say } from "@/components/Toaster";
import type { Field as Answer } from "@/lib/queries";

const VALUE = { name: "value", label: "answer", blocking: true } as const;
const NOTES = { name: "notes", placeholder: "note", quiet: true } as const;
const TRACKS = { ["--tracks" as string]: "minmax(0,0.9fr) minmax(0,1.3fr) minmax(0,1.1fr) auto" };

export default function ProfileSection({ section, rows }: { section: string; rows: Answer[] }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const router = useRouter();

  const add = async () => {
    if (!name.trim()) return;
    const result = await save("profile", null, {
      field: `${section}.${name.trim().replace(/\s+/g, "_")}`,
      value,
    });
    if ("error" in result) return say(result.error, true);
    setName("");
    setValue("");
    say("added");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.rowid} className="rowgrid items-center rounded-xl bg-sunk p-3 md:bg-transparent md:p-0"
             style={TRACKS}>
          <label className="text-sm md:pt-2" htmlFor={`f${row.rowid}`}>
            {row.field.slice(section.length + 1).replace(/_/g, " ")}
            {row.value === null && <span className="ml-1.5 text-xs text-bad">needs an answer</span>}
          </label>
          <Field table="profile" rowid={row.rowid} column={VALUE} value={row.value} />
          <Field table="profile" rowid={row.rowid} column={NOTES} value={row.notes} />
          <div className="flex justify-end md:block">
            <DeleteButton table="profile" rowid={row.rowid} what={row.field} />
          </div>
        </div>
      ))}

      <div className="rowgrid rounded-xl border border-dashed border-line p-3" style={TRACKS}
           onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }}>
        <input className="field" placeholder="another question they ask" value={name}
               aria-label={`new ${section} field`}
               onChange={(event) => setName(event.target.value)} />
        <input className="field" placeholder="your answer" value={value} aria-label="answer"
               onChange={(event) => setValue(event.target.value)} />
        <span className="hidden md:block" />
        <button type="button" onClick={add}
                className="h-8 shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink hover:brightness-110">
          Add
        </button>
      </div>
    </div>
  );
}
