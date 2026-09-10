import { columns } from "job/schema";

export type Hint = {
  type?: "email" | "tel" | "url" | "time" | "number";
  pattern?: string;
  placeholder?: string;
  min?: number;
  step?: number;
  flag?: true;
};

type Group = { label: string; from: string; fold?: boolean };

const LINK: Hint = { type: "url", pattern: "https?://.+\\..+", placeholder: "https://" };
const FLAG: Hint = { flag: true };

const HINTS: Record<string, Hint> = {
  email: { type: "email", pattern: ".+@.+\\..+" },
  phone: { type: "tel", pattern: "[^A-Za-z]{7,}", placeholder: "555-555-0100" },
  location: { placeholder: "City, State" },
  linkedin: LINK,
  github: LINK,
  authorized_in_country_of_residence: FLAG,
  legal_right_to_work_without_sponsorship: FLAG,
  requires_sponsorship_now_or_future: FLAG,
  over_18: FLAG,
  earliest_daily_start: { type: "time" },
  willing_to_relocate: FLAG,
  compensation_floor: { type: "number", min: 0, step: 1, placeholder: "120000" },
  compensation_currency: { pattern: "[A-Z]{3}", placeholder: "USD" },
};

const GROUPS: Group[] = [
  { label: "Contact", from: "full_name" },
  { label: "Work authorization", from: "authorized_in_country_of_residence" },
  { label: "Availability", from: "earliest_daily_start" },
  { label: "Preferences", from: "employment_type" },
  { label: "Demographics", from: "gender", fold: true },
];

export const hint = (column: string): Hint => HINTS[column] ?? {};

export function grouped() {
  const names = columns("identity");
  const missing = GROUPS.filter((group) => !names.includes(group.from));
  if (missing.length)
    throw new Error(`identity groups start at no such column: ${missing.map((group) => group.from).join(", ")}`);

  const groups = GROUPS.map((group) => ({ label: group.label, fold: group.fold, names: [] as string[] }));
  let open = groups[0];
  for (const name of names) {
    const starts = GROUPS.findIndex((group) => group.from === name);
    if (starts !== -1) open = groups[starts];
    open.names.push(name);
  }
  return groups;
}
