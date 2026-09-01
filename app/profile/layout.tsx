import Glyph from "@/components/Glyph";
import Tabs from "@/components/Tabs";
import { PANELS, slugFor } from "./panels";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { ScreenHead } from "@/components/ui";
import { answers, vocabularies } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  const asked = answers();
  const blocking = asked.filter((answer) => answer.value === null);

  return (
    <VocabularyProvider value={vocabularies()}>
      <ScreenHead headline="Everything an application draws on.">
        <p className="mt-3 max-w-2xl text-sm text-soft">
          The better this page is, the better the work the app finds. An answer saves the moment
          you leave it; clearing one takes it back.
        </p>
      </ScreenHead>

      <Tabs items={Object.entries(PANELS).map(([slug, panel]) => ({
        href: `/profile/${slug}`,
        label: panel.tab,
        icon: <Glyph icon={panel.icon} />,
        missing: blocking.filter((answer) => slugFor(answer.section) === slug).length,
      }))} />
      {children}
    </VocabularyProvider>
  );
}
