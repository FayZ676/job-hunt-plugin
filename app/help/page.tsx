import fs from "node:fs";
import path from "node:path";

import { ROOT } from "@/lib/core/root";
import Ledger from "@/components/Ledger";
import { Card, Prose, ScreenHead, Section, Sheet } from "@/components/ui";

export const dynamic = "force-dynamic";

type Manual = {
  lead: string;
  commands: { call: string; does: string }[];
  notes: string[];
};

const COMMAND = /^ {2}(\S.*?) {2,}(\S.*)$/;
const NOTE = /^ {2}(\S.*)$/;

function parse(text: string): Manual {
  const lines = text.split("\n");
  const said = lines.slice(0, lines.findIndex((line) => line.trim() === ""))
    .join(" ").replace(/^job — /, "").replace(/\s+/g, " ").trim();
  const lead = said.charAt(0).toUpperCase() + said.slice(1);

  const commands: Manual["commands"] = [];
  const notes: string[] = [];
  let section: "commands" | "notes" | null = null;

  for (const line of lines) {
    const heading = line.trim();
    if (heading === "commands:" || heading === "notes:") {
      section = heading.slice(0, -1) as "commands" | "notes";
      continue;
    }
    if (!line.trim()) continue;
    if (section === "commands") {
      const found = COMMAND.exec(line);
      if (found) commands.push({ call: found[1].trim(), does: found[2].trim() });
    } else if (section === "notes") {
      const found = NOTE.exec(line);
      if (found) notes.push(found[1].trim());
    }
  }

  return { lead, commands, notes };
}

const TICKS = /`([^`]+)`/g;

const marked = (text: string) =>
  text.split(TICKS).map((piece, index) =>
    index % 2 === 1
      ? <code key={index} className="rounded-selector bg-base-200 px-1 py-0.5 font-mono text-[0.8em]">
          {piece}
        </code>
      : piece);

export default function HelpPage() {
  const raw = fs.readFileSync(path.join(ROOT, "cli", "help.txt"), "utf8");
  const manual = parse(raw);

  if (manual.commands.length === 0) {
    return (
      <>
        <ScreenHead kicker="Help" headline="Job commands" />
        <Card><Prose className="font-mono text-xs">{raw}</Prose></Card>
      </>
    );
  }

  return (
    <>
      <ScreenHead kicker="Help" headline={manual.lead}>
        <p className="mt-3 text-sm text-soft">
          Every command is typed into Claude Code, not a shell.
        </p>
      </ScreenHead>

      <Section title="Commands">
        <Sheet bands={[{
          notes: manual.commands.map(({ call, does }) => ({
            label: (
              <span className="font-mono text-sm text-base-content">
                <span className="text-soft">/job</span>
                {call !== "(none)" && ` ${call}`}
              </span>
            ),
            value: does,
          })),
        }]} />
      </Section>

      {manual.notes.length > 0 && (
        <Section title="Worth knowing">
          <Ledger
            headless
            head={[{ label: "Note" }]}
            rows={manual.notes.map((note) => ({
              key: note,
              cells: [<span key="n" className="leading-relaxed">{marked(note)}</span>],
            }))}
          />
        </Section>
      )}
    </>
  );
}
