export type Column = {
  name: string;
  label?: string;
  kind?: "text" | "area" | "select";
  options?: (string | [string, string])[];
  vocabulary?: "section" | "kind" | "status";
  required?: boolean;
  blocking?: boolean;
  width?: string;
  placeholder?: string;
  quiet?: boolean;
};

export const title = (column: Column) =>
  column.label ?? column.name.replace(/_/g, " ");

export const COLUMNS = {
  profile: [
    { name: "value", label: "answer", blocking: true, width: "minmax(0,1.4fr)" },
    { name: "notes", kind: "area", width: "minmax(0,1fr)" },
  ],
  profileNew: [
    { name: "field", placeholder: "section.name", width: "minmax(0,1fr)" },
    { name: "value", label: "answer", width: "minmax(0,1.4fr)" },
    { name: "notes", width: "minmax(0,1fr)" },
  ],
  education: [
    { name: "degree", width: "minmax(0,1.2fr)" },
    { name: "institution", width: "minmax(0,1.2fr)" },
    { name: "finished", label: "year", width: "minmax(0,0.6fr)" },
  ],
  employers: [
    { name: "name", label: "employer", width: "minmax(0,1.4fr)" },
    { name: "title", label: "your title", width: "minmax(0,1.4fr)" },
    { name: "start", width: "minmax(0,0.7fr)" },
    { name: "finish", width: "minmax(0,0.7fr)" },
    { name: "current", label: "still there",
      options: [["0", "no"], ["1", "yes"]], required: true, width: "minmax(0,0.7fr)" },
  ],
  employerContext: [{ name: "context", label: "what the company does", kind: "area" }],
  projects: [
    { name: "name", label: "project", width: "minmax(0,1.6fr)" },
    { name: "status", vocabulary: "status", width: "minmax(0,0.9fr)" },
    { name: "start", width: "minmax(0,0.7fr)" },
    { name: "finish", width: "minmax(0,0.7fr)" },
  ],
  projectDetail: [
    { name: "summary", kind: "area", label: "what it was" },
    { name: "shared_with", label: "shared with", placeholder: "one other engineer" },
    { name: "notes", kind: "area" },
  ],
  bullets: [
    { name: "text", label: "bullet", kind: "area", width: "minmax(0,1fr)" },
    { name: "seq", label: "order", width: "minmax(0,0.4fr)" },
  ],
  metrics: [{ name: "metric", kind: "area" }],
  links: [
    { name: "label", width: "minmax(0,0.8fr)" },
    { name: "url", width: "minmax(0,2fr)" },
  ],
  criteria: [
    { name: "kind", vocabulary: "kind", required: true, width: "minmax(0,1.1fr)" },
    { name: "value", width: "minmax(0,1.4fr)" },
    { name: "weight", width: "minmax(0,0.5fr)" },
    { name: "note", width: "minmax(0,1.4fr)" },
  ],
  notes: [
    { name: "topic", width: "minmax(0,0.9fr)" },
    { name: "note", kind: "area", width: "minmax(0,2.4fr)" },
  ],
  facts: [{ name: "fact", kind: "area" }],
  accounts: [
    { name: "employer", width: "minmax(0,1fr)" },
    { name: "system", width: "minmax(0,0.8fr)" },
    { name: "login_email", label: "login", width: "minmax(0,1.2fr)" },
    { name: "password_location", label: "password lives", width: "minmax(0,1.2fr)" },
    { name: "portal_url", label: "portal", width: "minmax(0,1.2fr)" },
  ],
  limits: [
    { name: "company", width: "minmax(0,0.9fr)" },
    { name: "stated", label: "what you told them", kind: "area", width: "minmax(0,2.4fr)" },
  ],
} satisfies Record<string, Column[]>;
