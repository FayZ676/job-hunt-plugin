import Field from "@/components/edit/Field";
import RecordList, { type Record_ } from "@/components/edit/RecordList";
import type { Column } from "@/components/edit/columns";
import { Card, ScreenHead, Section } from "@/components/ui";
import { scope, titles } from "@/lib/queries";

export const dynamic = "force-dynamic";

const RUBRIC: Column = {
  name: "worth_applying_to", kind: "area", rows: 18,
  className: "max-h-[28rem] overflow-auto",
  placeholder: "What makes an opening worth applying to, what puts you off, and what makes you "
    + "skip it outright — including the seniority you are after and the years a posting may ask "
    + "for. Written the way you would explain it to someone reading the JD for you.",
};

const TITLE: Column[] = [{ name: "value", label: "title", required: true }];

export default function CriteriaPage() {
  return (
    <>
      <ScreenHead
        kicker="Search criteria"
        headline={<>What the search goes looking for, and what it lets past.</>}
      />

      <Section title="What you are looking for">
        <Card>
          <Field table="search_scope" rowid={1} column={RUBRIC} value={scope().worth_applying_to} />
        </Card>
      </Section>

      <Section title="Titles" sub="What the paid search asks for. Drag to reorder.">
        <RecordList
          table="search_titles"
          columns={TITLE}
          rows={titles() as Record_[]}
          what="this title"
          addLabel="Add a title"
          empty="Nothing here yet."
          ordered
        />
      </Section>
    </>
  );
}
