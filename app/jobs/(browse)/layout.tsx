import { Briefcase, NotebookPen } from "lucide-react";
import Glyph from "@/components/Glyph";
import Tabs from "@/components/Tabs";
import { ScreenHead } from "@/components/ui";
import { stats } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

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
  const counts = Object.fromEntries(stats().map((group) => [group.status ?? "", group.n]));

  return (
    <>
      <ScreenHead headline={headline(counts["shortlisted"] ?? 0, counts["staged"] ?? 0)} />
      <Tabs items={[
        { href: "/jobs", label: "Openings", icon: <Glyph icon={Briefcase} /> },
        { href: "/jobs/instructions", label: "Instructions",
          icon: <Glyph icon={NotebookPen} /> },
      ]} />
      {children}
    </>
  );
}
