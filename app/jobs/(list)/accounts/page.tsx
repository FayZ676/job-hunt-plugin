import RecordList, { type Record_ } from "@/components/edit/RecordList";
import { COLUMNS } from "@/components/edit/columns";
import { Section } from "@/components/ui";
import { accounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return (
    <Section title="Accounts" sub="Where an employer login lives. Never the password itself.">
      <RecordList table="accounts" columns={COLUMNS.accounts} rows={accounts() as Record_[]}
                  what="this account" addLabel="Add" />
    </Section>
  );
}
