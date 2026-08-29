import Link from "next/link";
import Tabs from "@/components/Tabs";
import { PANELS, slugFor } from "./panels";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { Meter, PageHeader } from "@/components/ui";
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
        <div className="mb-7 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2
          border-signal py-1 pl-3 text-sm">
          <span className="font-medium">
            {blocking.length === 1 ? "One answer is missing." : `${blocking.length} answers are missing.`}
          </span>
          <span className="text-soft">
            A form asking for {blocking.length === 1 ? "it" : "one of them"} stops rather than guesses.
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {blocking.map((answer) => (
              <Link key={`${answer.section}.${answer.field}`}
                    href={`/profile/${slugFor(answer.section)}`}
                    className="underline decoration-base-300 underline-offset-2
                      hover:decoration-current">
                {answer.field.replace(/_/g, " ")}
              </Link>
            ))}
          </span>
        </div>
      )}

      <Tabs items={Object.entries(PANELS).map(([slug, panel]) => ({
        href: `/profile/${slug}`,
        label: panel.tab ?? panel.title,
        missing: blocking.filter((answer) => slugFor(answer.section) === slug).length,
      }))} />
      {children}
    </VocabularyProvider>
  );
}
