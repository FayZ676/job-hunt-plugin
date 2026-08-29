export type Column = {
  name: string;
  label?: string;
  kind?: "text" | "area" | "select";
  type?: "email" | "tel" | "url" | "date" | "time" | "number";
  pattern?: string;
  min?: number;
  step?: number;
  options?: (string | [string, string])[];
  vocabulary?: "kind" | "status";
  required?: boolean;
  blocking?: boolean;
  width?: string;
  placeholder?: string;
  quiet?: boolean;
};

export const title = (column: Column) =>
  column.label ?? column.name.replace(/_/g, " ");

export const YES_NO: [string, string][] = [["1", "yes"], ["0", "no"]];

export const WHEN = { pattern: "\\d{4}(-\\d{2}){0,2}", placeholder: "2024, 2024-06 or 2024-06-01" };
export const EMAIL = { type: "email", pattern: ".+@.+\\..+" } as const;
export const LINK = { type: "url", pattern: "https?://.+\\..+", placeholder: "https://" } as const;

export const COLUMNS = {
  education: [
    { name: "degree", required: true, width: "minmax(0,1.2fr)" },
    { name: "institution", width: "minmax(0,1.2fr)" },
    { name: "finished", label: "year", ...WHEN, width: "minmax(0,0.6fr)" },
  ],
  employers: [
    { name: "name", label: "employer", required: true, width: "minmax(0,1.4fr)" },
    { name: "title", label: "your title", width: "minmax(0,1.4fr)" },
    { name: "start", ...WHEN, width: "minmax(0,0.7fr)" },
    { name: "finish", ...WHEN, width: "minmax(0,0.7fr)" },
    { name: "current", label: "still there",
      options: YES_NO, required: true, width: "minmax(0,0.7fr)" },
  ],
  employerContext: [{ name: "context", label: "what the company does", kind: "area" }],
  projects: [
    { name: "name", label: "project", required: true, width: "minmax(0,1.6fr)" },
    { name: "status", vocabulary: "status", width: "minmax(0,0.9fr)" },
    { name: "start", ...WHEN, width: "minmax(0,0.7fr)" },
    { name: "finish", ...WHEN, width: "minmax(0,0.7fr)" },
  ],
  projectDetail: [
    { name: "summary", kind: "area", label: "what it was" },
    { name: "shared_with", label: "shared with", placeholder: "one other engineer" },
    { name: "notes", kind: "area" },
  ],
  bullets: [
    { name: "text", label: "bullet", kind: "area", required: true, width: "minmax(0,1fr)" },
    { name: "seq", label: "order", type: "number", min: 0, step: 1, width: "minmax(0,0.4fr)" },
  ],
  metrics: [{ name: "metric", kind: "area", required: true }],
  links: [
    { name: "label", required: true, width: "minmax(0,0.8fr)" },
    { name: "url", ...LINK, required: true, width: "minmax(0,2fr)" },
  ],
  criteria: [
    { name: "kind", vocabulary: "kind", required: true, width: "minmax(0,1.1fr)" },
    { name: "value", required: true, width: "minmax(0,2.4fr)" },
    { name: "seq", label: "order", type: "number", min: 0, step: 1, width: "minmax(0,0.4fr)" },
  ],
  accounts: [
    { name: "employer", required: true, width: "minmax(0,1fr)" },
    { name: "system", width: "minmax(0,0.8fr)" },
    { name: "login_email", label: "login", ...EMAIL, width: "minmax(0,1.2fr)" },
    { name: "password_location", label: "password lives", width: "minmax(0,1.2fr)" },
    { name: "portal_url", label: "portal", ...LINK, width: "minmax(0,1.2fr)" },
  ],
} satisfies Record<string, Column[]>;
