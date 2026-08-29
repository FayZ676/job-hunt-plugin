import Tabs from "@/components/Tabs";
import { PANELS, slugFor } from "./panels";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { PageHeader } from "@/components/ui";
import { answers, vocabularies } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  const asked = answers();
  const blocking = asked.filter((answer) => answer.value === null);

  return (
    <VocabularyProvider value={vocabularies()}>
      <PageHeader
        title="Your profile"
        sub="Everything an application draws on. The better this page is, the better the work the
             app finds. An answer saves the moment you leave it; clearing one takes it back."
      />

      <Tabs items={Object.entries(PANELS).map(([slug, panel]) => ({
        href: `/profile/${slug}`,
        label: panel.tab,
        missing: blocking.filter((answer) => slugFor(answer.section) === slug).length,
      }))} />
      {children}
    </VocabularyProvider>
  );
}
