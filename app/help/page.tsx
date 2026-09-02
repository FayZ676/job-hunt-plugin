import fs from "node:fs";
import path from "node:path";

import { ROOT } from "@/lib/core/root";
import { Card, Prose, ScreenHead, Section, Sheet } from "@/components/ui";

export const dynamic = "force-dynamic";

type Manual = {
  commands: { call: string; does: string }[];
  notes: string[];
};

const COMMAND = /^ {2}(\S.*?) {2,}(\S.*)$/;
const NOTE = /^ {2}(\S.*)$/;

function parse(text: string): Manual {
  const lines = text.split("\n");

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

  return { commands, notes };
}

const TICKS = /`([^`]+)`/g;

const marked = (text: string) =>
  text.split(TICKS).map((piece, index) =>
    index % 2 === 1 ? (
      <code key={index} className="rounded-selector bg-base-200 px-1 py-0.5 font-mono text-[0.8em]">
        {piece}
      </code>
    ) : (
      piece
    ),
  );

export default function HelpPage() {
  const raw = fs.readFileSync(path.join(ROOT, "cli", "help.txt"), "utf8");
  const manual = parse(raw);

  if (manual.commands.length === 0) {
    return (
      <div className="max-w-4xl">
        <ScreenHead headline="Job commands" />
        <Card readout>
          <Prose className="font-mono text-xs">{raw}</Prose>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <ScreenHead headline="Job commands" />

      <Section title="Commands">
        <Sheet
          readout
          bands={[
            {
              notes: manual.commands.map(({ call, does }) => ({
                label: (
                  <span className="font-mono text-sm text-base-content">
                    <span className="text-soft">/job</span>
                    {call !== "(none)" && ` ${call}`}
                  </span>
                ),
                value: does,
              })),
            },
          ]}
        />
      </Section>

      {manual.notes.length > 0 && (
        <Section title="Worth knowing">
          <Card readout>
            <div className="space-y-2 text-sm leading-relaxed">
              {manual.notes.map((note) => (
                <p key={note}>{marked(note)}</p>
              ))}
            </div>
          </Card>
        </Section>
      )}
    </div>
  );
}
