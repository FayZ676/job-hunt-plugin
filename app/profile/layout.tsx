import Link from "next/link";
import Tabs from "./Tabs";
import { PANELS, slugFor } from "./panels";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { Card, Meter, PageHeader } from "@/components/ui";
import { answers, vocabularies } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  const asked = answers();
  const blocking = asked.filter((answer) => answer.value === null);

  return (
    <VocabularyProvider value={vocabularies()}>
      <PageHeader
        title="Your profile"
        sub="Everything an application draws on. A box saves the moment you leave it, and
             emptying one takes the answer back."
      >
        <div className="mt-4">
          <Meter done={asked.length - blocking.length} total={asked.length} />
        </div>
      </PageHeader>

      {blocking.length > 0 && (
        <Card className="mb-8 border-error bg-error/10">
          <p className="text-sm font-medium">
            {blocking.length} unanswered — a form asking for one of these stops rather than guesses.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs opacity-60">
            {blocking.map((answer) => (
              <li key={`${answer.section}.${answer.field}`}>
                <Link href={`/profile/${slugFor(answer.section)}`} className="link">
                  {answer.section}.{answer.field}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Tabs items={Object.entries(PANELS).map(([slug, panel]) => ({
        slug,
        label: panel.tab ?? panel.title,
        missing: blocking.filter((answer) => slugFor(answer.section) === slug).length,
      }))} />
      {children}
    </VocabularyProvider>
  );
}
