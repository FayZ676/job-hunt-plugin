"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/actions";
import DeleteButton from "@/components/edit/DeleteButton";
import Field from "@/components/edit/Field";
import { say } from "@/components/Toaster";
import type { Field as Answer } from "@/lib/queries";

const VALUE = { name: "value", label: "answer", blocking: true } as const;
const TRACKS = { ["--tracks" as string]: "minmax(0,0.9fr) minmax(0,1.6fr) auto" };

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
        <div key={row.rowid} style={TRACKS}
             className="rowgrid items-center rounded-box bg-base-200 p-3 md:bg-transparent md:p-0">
          <label className="text-sm md:pt-2" htmlFor={`f${row.rowid}`}>
            {row.field.slice(section.length + 1).replace(/_/g, " ")}
            {row.value === null && <span className="ml-1.5 text-xs text-error">needs an answer</span>}
          </label>
          <Field table="profile" rowid={row.rowid} column={VALUE} value={row.value} />
          <div className="flex justify-end md:block">
            <DeleteButton table="profile" rowid={row.rowid} what={row.field} />
          </div>
        </div>
      ))}

      <div className="rowgrid rounded-box border border-dashed border-base-300 p-3" style={TRACKS}
           onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }}>
        <input className="input input-sm w-full" placeholder="another question they ask" value={name}
               aria-label={`new ${section} field`}
               onChange={(event) => setName(event.target.value)} />
        <input className="input input-sm w-full" placeholder="your answer" value={value} aria-label="answer"
               onChange={(event) => setValue(event.target.value)} />
        <button type="button" onClick={add} className="btn btn-sm btn-primary">Add</button>
      </div>
    </div>
  );
}
