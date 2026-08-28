import fs from "node:fs";
import path from "node:path";
import { Card, PageHeader, Prose } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  const text = fs.readFileSync(path.join(process.cwd(), "..", "jobhunt", "help.txt"), "utf8");
  return (
    <>
      <PageHeader title="Job commands" sub="Everything here runs from a terminal, typed into Claude Code." />
      <Card><Prose className="font-mono text-xs">{text}</Prose></Card>
    </>
  );
}
