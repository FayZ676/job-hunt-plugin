import Field from "@/components/edit/Field";
import { Card, Label } from "@/components/ui";
import { EMAIL, LINK, YES_NO, title, type Column } from "@/components/edit/columns";
import {
  availability, compensation, experience, identity, options,
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
  const held = identity();
  const ask = asking("identity", held);
  const choice = (name: string) => ask({ name, options: options("identity", name) });
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

      <Label>Work authorization — asked on nearly every form</Label>
      {ask({ name: "authorized_in_country_of_residence", options: YES_NO })}
      {ask({ name: "legal_right_to_work_without_sponsorship", options: YES_NO })}
      {ask({ name: "requires_sponsorship_now_or_future", options: YES_NO })}
      {ask({ name: "over_18", options: YES_NO })}

      <Label>Optional on most forms — answer only what you want reported</Label>
      {choice("gender")}
      {choice("race_ethnicity")}
      {choice("hispanic_or_latino")}
      {choice("veteran_status")}
      {choice("disability_status")}
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


export function Experience() {
  const { years, relevant_years, clock_starts } = experience();
  return (
    <Card className="mb-6">
      <Label>Years of experience — what a form asks for as a number</Label>
      {years === null ? (
        <p className="text-sm text-error">
          No employer dates yet, so a form asking for years of experience has nothing to answer with.
        </p>
      ) : (
        <p className="text-sm">
          <span className="font-medium">{years} years</span>, {relevant_years} of them relevant,
          counted from {clock_starts} — the earliest start below. Correct a date on an employer;
          there is no total to edit.
        </p>
      )}
    </Card>
  );
}

