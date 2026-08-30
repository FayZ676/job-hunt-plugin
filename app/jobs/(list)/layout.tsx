import Rail from "@/components/Rail";
import Tabs from "@/components/Tabs";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { ScreenHead } from "@/components/ui";
import { stats, vocabularies } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/jobs", label: "Openings" },
  { href: "/jobs/criteria", label: "Criteria" },
];

function headline(waiting: number, ready: number) {
  if (waiting > 0) {
    return <>
      <span className="tnum">{waiting}</span>
      {waiting === 1 ? " opening needs" : " openings need"} your call.
    </>;
  }
  if (ready > 0) {
    return <>
      Nothing new to judge. <span className="tnum">{ready}</span>
      {ready === 1 ? " application is" : " applications are"} filled and waiting to send.
    </>;
  }
  return <>Nothing is waiting on you.</>;
}

export default function JobsLayout({ children }: LayoutProps<"/jobs">) {
  const tallies = stats().map((group) => ({ status: group.status ?? "", n: group.n }));
  const count = (status: string) => tallies.find((t) => t.status === status)?.n ?? 0;

  return (
    <VocabularyProvider value={vocabularies()}>
      <ScreenHead kicker="Jobs" headline={headline(count("shortlisted"), count("staged"))}>
        <Rail tallies={tallies} />
      </ScreenHead>
      <Tabs items={TABS} />
      {children}
    </VocabularyProvider>
  );
}
