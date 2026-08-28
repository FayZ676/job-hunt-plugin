"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/actions";
import { title, type Column } from "./columns";
import { say } from "@/components/Toaster";
import { useVocabulary } from "./Vocabulary";

type State = "" | "saving" | "saved" | "failed";

export function Control({ column, value, onValue, onCommit, state, autoFocus }: {
  column: Column;
  value: string;
  onValue: (value: string) => void;
  onCommit?: (value: string) => void;
  state?: State;
  autoFocus?: boolean;
}) {
  const vocabulary = useVocabulary();
  const shared = {
    className: `field${column.quiet ? " quiet" : ""}`,
    "data-state": state || undefined,
    "data-blocking": column.blocking ? "yes" : undefined,
    placeholder: column.placeholder ?? title(column),
    "aria-label": title(column),
    autoFocus,
    value,
    onChange: (event: { target: { value: string } }) => onValue(event.target.value),
    onBlur: () => onCommit?.(value),
  };

  const options = column.options ?? (column.vocabulary && vocabulary[column.vocabulary]);
  if (options)
    return (
      <select {...shared} onChange={(event) => { onValue(event.target.value); onCommit?.(event.target.value); }}>
        {!column.required && <option value="">—</option>}
        {options.map((option) => {
          const [held, shown] = Array.isArray(option) ? option : [option, option.replace(/_/g, " ")];
          return <option key={held} value={held}>{shown}</option>;
        })}
      </select>
    );
  if (column.kind === "area") return <textarea {...shared} rows={2} />;
  return <input {...shared} />;
}

export default function Field({ table, rowid, column, value }: {
  table: string; rowid: number; column: Column; value: string | number | null;
}) {
  const [held, setHeld] = useState(value === null || value === undefined ? "" : String(value));
  const [state, setState] = useState<State>("");
  const router = useRouter();

  const commit = async (next: string) => {
    if (next === (value === null || value === undefined ? "" : String(value))) return setState("");
    setState("saving");
    const result = await save(table, rowid, { [column.name]: next });
    if ("error" in result) {
      setState("failed");
      say(result.error, true);
      return;
    }
    setState("saved");
    router.refresh();
    setTimeout(() => setState(""), 1400);
  };

  return <Control column={column} value={held} onValue={setHeld} onCommit={commit} state={state} />;
}
