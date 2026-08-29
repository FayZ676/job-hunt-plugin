import Field from "@/components/edit/Field";
import { EMAIL, LINK, YES_NO, title, type Column } from "@/components/edit/columns";
import { identity, options } from "@/lib/queries";

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
      { name: "earliest_start", type: "date" },
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

const OPTIONAL: () => Group = () => ({
  fields: [
    choice("gender"),
    choice("race_ethnicity"),
    choice("hispanic_or_latino"),
    choice("veteran_status"),
    choice("disability_status"),
  ],
});

function Row({ column, value }: { column: Column; value: unknown }) {
  const answer = (value ?? null) as string | number | null;
  const missing = answer === null;
  return (
    <div className="grid grid-cols-1 items-center gap-x-6 gap-y-0.5 px-4 py-1.5
      sm:grid-cols-[13rem_minmax(0,1fr)]">
      <label className="flex items-center gap-1.5 text-sm text-soft">
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full
          ${missing ? "bg-signal" : "bg-transparent"}`} />
        {title(column)}
        {missing && <span className="sr-only">— needs an answer</span>}
      </label>
      <Field table="identity" rowid={1} value={answer}
             column={{ ...column, quiet: true, blocking: true, label: title(column),
                       className: column.options ? "max-w-64" : "max-w-xl",
                       placeholder: column.placeholder ?? "—" }} />
    </div>
  );
}

const Heading = ({ label, note }: { label: string; note?: string }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-y border-base-200
    bg-base-200 px-4 py-2 first:border-t-0">
    <h3 className="eyebrow">{label}</h3>
    {note && <p className="text-xs text-soft">{note}</p>}
  </div>
);

export function Identity() {
  const row = held();
  return (
    <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
      {GROUPS().map((group) => (
        <section key={group.label}>
          {group.label && <Heading label={group.label} note={group.note} />}
          <div className="divide-y divide-base-200 py-1">
            {group.fields.map((column) => (
              <Row key={column.name} column={column} value={row[column.name]} />
            ))}
          </div>
        </section>
      ))}

      <details className="group border-t border-base-200">
        <summary className="flex cursor-pointer list-none items-baseline gap-2 bg-base-200 px-4 py-2
          transition-colors hover:bg-base-300 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-soft transition-transform group-open:rotate-90">›</span>
          <h3 className="eyebrow">Demographics</h3>
          <p className="ml-auto text-xs text-soft">
            Optional on most forms. Answer only what you want reported.
          </p>
        </summary>
        <div className="divide-y divide-base-200 py-1">
          {OPTIONAL().fields.map((column) => (
            <Row key={column.name} column={column} value={row[column.name]} />
          ))}
        </div>
      </details>
    </div>
  );
}
