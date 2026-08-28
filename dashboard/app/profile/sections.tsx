import Field from "@/components/edit/Field";
import { EMAIL, LINK, YES_NO, title, type Column } from "@/components/edit/columns";
import {
  availability, compensation, demographics, experience, identity, options,
  searchProfile, workAuthorization,
} from "@/lib/queries";

const TRACKS = { ["--tracks" as string]: "minmax(0,0.9fr) minmax(0,1.6fr)" };

const asking = (table: string, row: object) => (column: Column) => {
  const value = ((row as Record<string, unknown>)[column.name] ?? null) as string | number | null;
  return (
    <div key={column.name} style={TRACKS}
         className="rowgrid items-center rounded-box bg-base-200 p-3 md:bg-transparent md:p-0">
      <label className="text-sm md:pt-2">
        {title(column)}
        {value === null && <span className="ml-1.5 text-xs text-error">needs an answer</span>}
      </label>
      <Field table={table} rowid={1} value={value}
             column={{ ...column, label: "answer", blocking: true }} />
    </div>
  );
};

const Fields = ({ children }: { children: React.ReactNode }) =>
  <div className="space-y-2">{children}</div>;

export function Identity() {
  const ask = asking("identity", identity());
  return (
    <Fields>
      {ask({ name: "full_name" })}
      {ask({ name: "preferred_name" })}
      {ask({ name: "last_name" })}
      {ask({ name: "email", ...EMAIL })}
      {ask({ name: "phone", type: "tel", pattern: "[^A-Za-z]{7,}", placeholder: "555-555-0100" })}
      {ask({ name: "location" })}
      {ask({ name: "street_address" })}
      {ask({ name: "linkedin", ...LINK })}
      {ask({ name: "github", ...LINK })}
    </Fields>
  );
}

export function WorkAuthorization() {
  const ask = asking("work_authorization", workAuthorization());
  return (
    <Fields>
      {ask({ name: "authorized_in_country_of_residence", options: YES_NO })}
      {ask({ name: "legal_right_to_work_without_sponsorship", options: YES_NO })}
      {ask({ name: "requires_sponsorship_now_or_future", options: YES_NO })}
      {ask({ name: "over_18", options: YES_NO })}
    </Fields>
  );
}

export function Availability() {
  const ask = asking("availability", availability());
  return (
    <Fields>
      {ask({ name: "earliest_start", type: "date" })}
      {ask({ name: "earliest_daily_start", type: "time" })}
      {ask({ name: "notice_period", options: options("availability", "notice_period") })}
      {ask({ name: "employment_type", options: options("availability", "employment_type") })}
      {ask({ name: "remote_preference", options: options("availability", "remote_preference") })}
      {ask({ name: "willing_to_relocate", options: YES_NO })}
    </Fields>
  );
}

export function Compensation() {
  const ask = asking("compensation", compensation());
  return (
    <Fields>
      {ask({ name: "floor", type: "number", min: 0, step: 1 })}
      {ask({ name: "currency", pattern: "[A-Z]{3}", placeholder: "USD" })}
    </Fields>
  );
}

export function Demographics() {
  const ask = asking("demographics", demographics());
  return (
    <Fields>
      {ask({ name: "gender", options: options("demographics", "gender") })}
      {ask({ name: "race_ethnicity", options: options("demographics", "race_ethnicity") })}
      {ask({ name: "hispanic_or_latino", options: options("demographics", "hispanic_or_latino") })}
      {ask({ name: "veteran_status", options: options("demographics", "veteran_status") })}
      {ask({ name: "disability_status", options: options("demographics", "disability_status") })}
    </Fields>
  );
}

export function Experience() {
  const ask = asking("experience", experience());
  return (
    <Fields>
      {ask({ name: "years", type: "number", min: 0, step: 1 })}
      {ask({ name: "relevant_years", type: "number", min: 0, step: 1 })}
      {ask({ name: "clock_starts", type: "date" })}
    </Fields>
  );
}

export function Search() {
  const ask = asking("search", searchProfile());
  return (
    <Fields>
      {ask({ name: "home_metro" })}
      {ask({ name: "relocation", options: YES_NO })}
    </Fields>
  );
}
