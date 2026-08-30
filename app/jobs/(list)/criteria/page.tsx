import Field from "@/components/edit/Field";
import RecordList, { type Record_ } from "@/components/edit/RecordList";
import type { Column } from "@/components/edit/columns";
import { Section } from "@/components/ui";
import { scope, titles } from "@/lib/queries";

export const dynamic = "force-dynamic";

const RUBRIC: Column = {
  name: "worth_applying_to", kind: "area", rows: 18,
  placeholder: "What makes an opening worth applying to, what puts you off, and what makes you "
    + "skip it outright — including the seniority you are after and the years a posting may ask "
    + "for. Written the way you would explain it to someone reading the JD for you.",
};

const TITLE: Column[] = [{ name: "value", required: true, width: "minmax(0,1fr)" }];

export default function CriteriaPage() {
  return (
    <Section title="What you are looking for">
      <div className="space-y-8">
        <Field table="search_scope" rowid={1} column={RUBRIC} value={scope().worth_applying_to} />

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className="eyebrow">Titles</h3>
            <p className="text-xs text-soft">What the paid search asks for. Drag to reorder.</p>
          </div>
          <RecordList
            table="search_titles"
            columns={TITLE}
            rows={titles() as Record_[]}
            what="this title"
            addLabel="Add"
            empty="Nothing here yet."
            ordered
          />
        </div>
      </div>
    </Section>
  );
}
