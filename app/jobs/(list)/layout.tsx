import Tabs from "@/components/Tabs";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { PageHeader } from "@/components/ui";
import { vocabularies } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/jobs", label: "Openings" },
  { href: "/jobs/criteria", label: "Criteria" },
  { href: "/jobs/accounts", label: "Accounts" },
];

export default function JobsLayout({ children }: LayoutProps<"/jobs">) {
  return (
    <VocabularyProvider value={vocabularies()}>
      <PageHeader
        title="Jobs"
        sub="What you are looking for, where you log in to ask for it, and every opening the scan
             has turned up."
      />
      <Tabs items={TABS} />
      {children}
    </VocabularyProvider>
  );
}
