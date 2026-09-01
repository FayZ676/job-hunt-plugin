import Field from "@/components/edit/Field";
import { EMAIL, LINK, YES_NO, title, type Column } from "@/components/edit/columns";
import { Card, Disclosure, Sheet, Split, Stack, type Band, type Note } from "@/components/ui";
import { identity, instructions, options } from "@/lib/web/queries";

type Group = { label?: string; note?: string; fields: Column[] };

const held = () => identity() as unknown as Record<string, unknown>;

const choice = (name: string) => ({ name, options: options("identity", name) });

const GROUPS: () => Group[] = () => [
  {
    label: "How to reach you",
    fields: [
      { name: "full_name" },
      { name: "preferred_name", placeholder: "What you go by, if it differs" },
      { name: "last_name" },
      { name: "email", ...EMAIL },
      { name: "phone", type: "tel", pattern: "[^A-Za-z]{7,}", placeholder: "555-555-0100" },
      { name: "location", placeholder: "City, State" },
      { name: "street_address" },
      { name: "linkedin", ...LINK },
      { name: "github", ...LINK },
    ],
  },
  {
    label: "Work authorization",
    note: "Asked on nearly every form.",
    fields: [
      { name: "authorized_in_country_of_residence", options: YES_NO },
      { name: "legal_right_to_work_without_sponsorship", options: YES_NO },
      { name: "requires_sponsorship_now_or_future", options: YES_NO },
      { name: "over_18", options: YES_NO },
    ],
  },
  {
    label: "When you could start, and what you would take",
    fields: [
      { name: "earliest_daily_start", type: "time" },
      choice("notice_period"),
      choice("employment_type"),
      choice("remote_preference"),
      { name: "willing_to_relocate", options: YES_NO },
      { name: "compensation_floor", type: "number", min: 0, step: 1,
        placeholder: "The lowest number you would sign" },
      { name: "compensation_currency", pattern: "[A-Z]{3}", placeholder: "USD" },
    ],
  },
];

const OPTIONAL = [
  "gender", "race_ethnicity", "hispanic_or_latino", "veteran_status", "disability_status",
];

const noted = (row: Record<string, unknown>) => (column: Column): Note => {
  const answer = (row[column.name] ?? null) as string | number | null;
  return {
    label: title(column),
    mark: answer === null,
    value: (
      <Field table="identity" rowid={1} value={answer}
             column={{ ...column, blocking: true, label: title(column),
                       className: column.options ? "max-w-64" : "max-w-xl",
                       placeholder: column.placeholder ?? "—" }} />
    ),
  };
};

export function Identity() {
  const row = held();
  const note = noted(row);
  const band = (group: Group): Band =>
    ({ label: group.label, note: group.note, notes: group.fields.map(note) });
  const [reach, ...asked] = GROUPS();

  return (
    <Split rail={
      <>
        <Sheet bands={asked.map(band)} />

        <Stack>
          <Disclosure
            summary="Demographics"
            aside={<span className="hidden text-xs text-soft @2xl:block">
              Optional on most forms.
            </span>}
          >
            <Sheet flush bands={[{ notes: OPTIONAL.map(choice).map(note) }]} />
          </Disclosure>
        </Stack>
      </>
    }>
      <Sheet label="10rem" bands={[band(reach)]} />
    </Split>
  );
}

const INSTRUCTIONS: Column = {
  name: "text", kind: "area",
  className: "pane-max",
  placeholder: "The work to go looking for, in the words a job board would use for it, "
    + "strongest first — then what makes an opening worth applying to, what puts you off, and "
    + "what makes it a no outright, including the seniority you are after and the years a posting "
    + "may ask for. Written the way you would brief someone reading the JD on your behalf.",
};

export function Instructions() {
  return (
    <Card>
      <Field table="instructions" rowid={1} column={INSTRUCTIONS} value={instructions().text} />
    </Card>
  );
}
