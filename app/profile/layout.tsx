import Glyph from "@/components/Glyph";
import Tabs from "@/components/Tabs";
import { PANELS, slugFor } from "./panels";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { answers, vocabularies } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  const asked = answers();
  const blocking = asked.filter((answer) => answer.value === null);

  return (
    <VocabularyProvider value={vocabularies()}>
      <Tabs
        items={Object.entries(PANELS).map(([slug, panel]) => ({
          href: `/profile/${slug}`,
          label: panel.tab,
          icon: <Glyph icon={panel.icon} />,
          missing: blocking.filter((answer) => slugFor(answer.section) === slug).length,
        }))}
      />
      {children}
    </VocabularyProvider>
  );
}
