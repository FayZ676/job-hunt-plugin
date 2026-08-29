import RecordList, { type Record_ } from "@/components/edit/RecordList";
import { COLUMNS } from "@/components/edit/columns";
import { Section } from "@/components/ui";
import { criteria } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function CriteriaPage() {
  return (
    <Section title="What you are looking for"
             sub="How a new opening gets scored. `kind` says how the scorer uses the row.">
      <RecordList table="search_criteria" columns={COLUMNS.criteria} rows={criteria() as Record_[]}
                  what="this criterion" addLabel="Add" />
    </Section>
  );
}
