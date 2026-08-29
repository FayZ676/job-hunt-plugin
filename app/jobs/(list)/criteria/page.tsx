import RecordList, { type Record_ } from "@/components/edit/RecordList";
import type { Column } from "@/components/edit/columns";
import { Section } from "@/components/ui";
import { criteria } from "@/lib/queries";

export const dynamic = "force-dynamic";

const KINDS: [string, string, string, boolean?][] = [
  ["title_preferred", "Titles you want", "A title matching one of these scores highest."],
  ["title_acceptable", "Titles you would take", "Counts, but below a preferred title."],
  ["title_excluded", "Titles to rule out", "A match here drops the opening from the scan."],
  ["title_penalty", "Titles that count against", "Scored down rather than ruled out."],
  ["brings", "What you bring", "A posting asking for these scores up.", true],
  ["score_up", "Scores it up", "Anything else in a posting worth points.", true],
  ["score_down", "Scores it down", "Present but not disqualifying.", true],
  ["dealbreaker", "Dealbreakers", "One of these and the opening is skipped, whatever it scored.", true],
  ["location_tier", "Where you would work", "Strongest first."],
  ["experience_floor", "Experience floor", "The years a posting may ask for before it stops fitting.", true],
  ["level", "Level", "The seniority the scan aims at."],
];

const shape = (prose?: boolean): Column[] => [
  { name: "value", kind: prose ? "area" : undefined, required: true, width: "minmax(0,1fr)" },
  { name: "seq", label: "rank", type: "number", min: 0, step: 1, width: "5rem" },
];

export default function CriteriaPage() {
  const all = criteria() as Record_[];

  return (
    <Section
      title="What you are looking for"
      sub="How a new opening gets scored. Within a group the lowest rank counts for most, so moving
           a row up is how you say this one matters more."
    >
      <div className="space-y-8">
        {KINDS.map(([kind, heading, note, prose]) => (
          <div key={kind}>
            <h3 className="font-display text-sm font-semibold tracking-tight">{heading}</h3>
            <p className="mb-3 mt-0.5 text-sm text-soft">{note}</p>
            <RecordList
              table="search_criteria"
              columns={shape(prose)}
              rows={all.filter((row) => row.kind === kind)}
              seed={{ kind }}
              what="this criterion"
              addLabel="Add"
              empty="Nothing here yet."
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
