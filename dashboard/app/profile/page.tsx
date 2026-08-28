import CareerEditor from "./CareerEditor";
import ProfileSection from "./ProfileSection";
import RecordList, { type Record_ } from "@/components/edit/RecordList";
import { COLUMNS } from "@/components/edit/columns";
import { VocabularyProvider } from "@/components/edit/Vocabulary";
import { Card, Meter, PageHeader, Section } from "@/components/ui";
import {
  accounts, career, criteria, education, facts, fields, limits, notes, vocabularies,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const SECTION_BLURB: Record<string, string> = {
  identity: "The name, address and links every form starts by asking for.",
  work_authorization: "Whether you can work somewhere, and whether you would need sponsoring.",
  availability: "When you could start, and what you owe your current employer.",
  compensation: "What you would take, and what you are on now.",
  demographics: "Optional on most forms. Answer only what you want reported.",
  experience: "The totals a form asks for as a number rather than a story.",
  search: "How you describe the job you want, in your own words.",
};

export default function ProfilePage() {
  const answers = fields();
  const vocabulary = vocabularies();
  const blocking = answers.filter((answer) => answer.value === null);

  return (
    <VocabularyProvider value={vocabulary}>
      <PageHeader
        title="Your profile"
        sub="Everything an application draws on. A box saves the moment you leave it, and
             emptying one takes the answer back."
      >
        <div className="mt-4">
          <Meter done={answers.length - blocking.length} total={answers.length} />
        </div>
      </PageHeader>

      {blocking.length > 0 && (
        <Card className="mb-8 border-bad bg-bad-soft">
          <p className="text-sm font-medium">
            {blocking.length} unanswered — a form asking for one of these stops rather than guesses.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-dim">
            {blocking.map((answer) => <li key={answer.field}>{answer.field}</li>)}
          </ul>
        </Card>
      )}

      {vocabulary.section.map((section) => (
        <Section key={section} title={section.replace(/_/g, " ")} sub={SECTION_BLURB[section]}>
          <ProfileSection section={section} rows={answers.filter((a) => a.section === section)} />
        </Section>
      ))}

      <Section
        title="Experience"
        sub="Employers, the projects inside them, and the bullets a resume is built from."
      >
        <CareerEditor employers={career()} />
      </Section>

      <Section title="Education">
        <RecordList table="education" columns={COLUMNS.education} rows={education() as Record_[]}
                    what="this degree" addLabel="Add" />
      </Section>

      <Section
        title="What you are looking for"
        sub="How a new opening gets scored. `kind` says how the scorer uses the row."
      >
        <RecordList table="search_criteria" columns={COLUMNS.criteria} rows={criteria() as Record_[]}
                    what="this criterion" addLabel="Add" />
      </Section>

      <Section
        title="Judgement"
        sub="What resists a schema, read on every scoring pass — this is what lets a case nobody
             enumerated still get called right."
      >
        <RecordList table="search_notes" columns={COLUMNS.notes} rows={notes() as Record_[]}
                    what="this note" addLabel="Add" />
      </Section>

      <Section
        title="Facts that must never be misreported"
        sub="Corrections a resume may never contradict."
      >
        <RecordList table="facts" columns={COLUMNS.facts} rows={facts() as Record_[]}
                    what="this fact" addLabel="Add" />
      </Section>

      <Section title="Accounts" sub="Where an employer login lives. Never the password itself.">
        <RecordList table="accounts" columns={COLUMNS.accounts} rows={accounts() as Record_[]}
                    what="this account" addLabel="Add" />
      </Section>

      <Section title="What you have told companies" sub="So a later application cannot contradict an earlier one.">
        <RecordList table="company_limits" columns={COLUMNS.limits} rows={limits() as Record_[]}
                    what="this limit" addLabel="Add" />
      </Section>
    </VocabularyProvider>
  );
}
