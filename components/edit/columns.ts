export type Column = {
  name: string;
  label?: string;
  kind?: "text" | "area" | "select";
  type?: "email" | "tel" | "url" | "date" | "time" | "number";
  pattern?: string;
  min?: number;
  step?: number;
  options?: (string | [string, string])[];
  vocabulary?: "status";
  required?: boolean;
  blocking?: boolean;
  width?: string;
  placeholder?: string;
  className?: string;
  rows?: number;
};

export const title = (column: Column) =>
  column.label ?? column.name.replace(/_/g, " ");

export const YES_NO: [string, string][] = [["1", "yes"], ["0", "no"]];

export const WHEN = { pattern: "\\d{4}(-\\d{2}){0,2}", placeholder: "2024, 2024-06 or 2024-06-01" };
export const EMAIL = { type: "email", pattern: ".+@.+\\..+" } as const;
export const LINK = { type: "url", pattern: "https?://.+\\..+", placeholder: "https://" } as const;

export const COLUMNS = {
  education: [
    { name: "degree", required: true, width: "40%" },
    { name: "institution", width: "40%" },
    { name: "finished", label: "year", ...WHEN, width: "20%" },
  ],
  employers: [
    { name: "name", label: "employer", required: true },
    { name: "title", label: "your title" },
    { name: "start", ...WHEN },
    { name: "finish", ...WHEN },
    { name: "current", label: "still there", options: YES_NO, required: true },
  ],
  employerContext: [{ name: "context", label: "what the company does", kind: "area" }],
  projects: [
    { name: "name", label: "project", required: true },
    { name: "status", vocabulary: "status" },
    { name: "start", ...WHEN },
    { name: "finish", ...WHEN },
  ],
  projectDetail: [
    { name: "summary", kind: "area", label: "what it was" },
    { name: "shared_with", label: "shared with", placeholder: "one other engineer" },
    { name: "notes", kind: "area" },
  ],
  bullets: [
    { name: "text", label: "bullet", kind: "area", required: true },
    { name: "seq", label: "order", type: "number", min: 0, step: 1 },
  ],
  metrics: [{ name: "metric", kind: "area", required: true }],
  links: [
    { name: "label", required: true, width: "30%" },
    { name: "url", ...LINK, required: true, width: "70%" },
  ],
} satisfies Record<string, Column[]>;
