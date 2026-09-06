export type Column = {
  name: string;
  label?: string;
  kind?: "text" | "area" | "select";
  type?: "email" | "tel" | "url" | "date" | "time" | "number";
  pattern?: string;
  min?: number;
  step?: number;
  options?: (string | [string, string])[];
  required?: boolean;
  blocking?: boolean;
  width?: string;
  placeholder?: string;
  className?: string;
  rows?: number;
  preview?: boolean;
};

export const title = (column: Column) => column.label ?? column.name.replace(/_/g, " ");

export const YES_NO: [string, string][] = [
  ["1", "yes"],
  ["0", "no"],
];

const WHEN = { pattern: "\\d{4}(-\\d{2}){0,2}", placeholder: "2024, 2024-06 or 2024-06-01" };

export const COLUMNS = {
  education: [
    { name: "degree", required: true, width: "45%" },
    { name: "institution", width: "40%" },
    { name: "finished", label: "year", ...WHEN, width: "15%" },
  ],
  employers: [
    { name: "name", label: "employer", required: true },
    { name: "title", label: "your title" },
    { name: "start", ...WHEN },
    { name: "finish", ...WHEN },
  ],
  projects: [
    { name: "name", label: "project", required: true },
    { name: "start", ...WHEN },
    { name: "finish", ...WHEN },
  ],
} satisfies Record<string, Column[]>;
