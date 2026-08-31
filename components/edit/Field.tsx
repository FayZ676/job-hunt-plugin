"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/web/actions";
import { answered } from "./answered";
import { title, type Column } from "./columns";
import { say } from "@/components/Toaster";
import { useVocabulary } from "./Vocabulary";

type State = "" | "saving" | "saved" | "failed";

const TONE: Record<State, string> = {
  "": "", saving: "", saved: "success", failed: "error",
};

type Entry = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function Control({ column, value, onValue, onCommit, state = "", autoFocus }: {
  column: Column;
  value: string;
  onValue: (value: string) => void;
  onCommit?: (value: string, entry: Entry) => void;
  state?: State;
  autoFocus?: boolean;
}) {
  const vocabulary = useVocabulary();
  const options = column.options ?? (column.vocabulary && vocabulary[column.vocabulary]);
  const tone = TONE[state] || (column.blocking && !value ? "error" : "");

  const dressed = `quietbox ${tone === "error" ? "quiet-missing" : ""}
    ${tone === "success" ? "quiet-saved" : ""}`;

  const shared = {
    className: `${dressed} ${column.className ?? ""}`,
    placeholder: column.placeholder ?? title(column),
    "aria-label": title(column),
    autoFocus,
    value,
    onChange: (event: { target: { value: string } }) => onValue(event.target.value),
    onBlur: (event: { currentTarget: Entry }) => onCommit?.(value, event.currentTarget),
  };

  if (options)
    return (
      <select {...shared}
              onChange={(event) => { onValue(event.target.value); onCommit?.(event.target.value, event.currentTarget); }}>
        {!column.required && <option value="">—</option>}
        {options.map((option) => {
          const [held, shown] = Array.isArray(option) ? option : [option, option.replace(/_/g, " ")];
          return <option key={held} value={held}>{shown}</option>;
        })}
      </select>
    );
  if (column.kind === "area")
    return <textarea {...shared} rows={column.rows ?? 2} required={column.required} />;
  return (
    <input {...shared} type={column.type ?? "text"} pattern={column.pattern}
           min={column.min} step={column.step} required={column.required} />
  );
}

export default function Field({ table, rowid, column, value }: {
  table: string; rowid: number; column: Column; value: string | number | null;
}) {
  const was = value === null || value === undefined ? "" : String(value);
  const [held, setHeld] = useState(was);
  const [state, setState] = useState<State>("");
  const router = useRouter();

  const commit = async (next: string, entry: Entry) => {
    if (next === was) return setState("");
    if (!entry.checkValidity()) {
      setState("failed");
      return say(entry.validationMessage, true);
    }
    setState("saving");
    const result = await answered(save(table, rowid, { [column.name]: next }));
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
