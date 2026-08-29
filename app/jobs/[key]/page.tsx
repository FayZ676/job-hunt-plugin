import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge, Card, DataTable, DefList, Label, Out, PageHeader, Prose, Score, Section, Stamp,
} from "@/components/ui";
import { shortDate } from "@/components/format";
import { prospect } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TIERS = ["identity", "policy", "judgment"] as const;

export default async function ProspectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = prospect(decodeURIComponent(key));
  if (!found) notFound();
  const { posting, staged } = found;

  const asset = (kind: string) => `/asset/${kind}/${encodeURIComponent(posting.key)}`;

  return (
    <>
      <Link href="/jobs" className="link link-primary text-sm">← Jobs</Link>
      <PageHeader
        title={`${posting.company} — ${posting.title}`}
        sub={
          <span className="flex items-center gap-2">
            <Score value={posting.score} /> ·
            <Badge>{posting.status}</Badge> ·
            <Stamp>{posting.key}</Stamp>
          </span>
        }
      />

      <Card className="mb-8">
        <DefList pairs={[
          ["Location", posting.location || (posting.remote ? "Remote" : "—")],
          ["Compensation", posting.compensation || "—"],
          ["Posted", shortDate(posting.posted_at)],
          ["First seen", shortDate(posting.first_seen)],
          ["Source", [posting.source, posting.ats].filter(Boolean)
            .filter((name, index, all) => all.indexOf(name) === index).join(" · ") || "—"],
          ["Posting", <Out key="u" href={posting.url}>open</Out>],
          ["Apply", <Out key="a" href={posting.apply_url}>open</Out>],
          found.aliases.length > 0 && ["Also listed as", <Stamp key="x">{found.aliases.join(" · ")}</Stamp>],
        ]} />
      </Card>

      {posting.reason && (
        <Section title="Why this score">
          <Card><Prose>{posting.reason}</Prose></Card>
        </Section>
      )}

      {staged && (
        <Section title="Staged application">
          <Card className="mb-4">
            <DefList pairs={[
              ["Form status", <Badge key="s">{staged.status}</Badge>],
              ["ATS", staged.ats || "—"],
              ["Apply URL", <Out key="u" href={staged.url}>open</Out>],
              staged.blocked_on !== null &&
                ["Blocked on", <span key="b" className="text-error">{staged.blocked_on}</span>],
            ]} />
          </Card>

          {TIERS.map((tier) => {
            const answers = found.fields.filter((field) => field.tier === tier);
            if (!answers.length) return null;
            return (
              <div key={tier} className="mb-4">
                <Label>{tier}</Label>
                <Card className="space-y-2 !p-0">
                  {answers.map((answer, index) => (
                    <div key={index}
                         className={`grid gap-1 border-b border-base-300 p-3 last:border-0
                           sm:grid-cols-[14rem_minmax(0,1fr)] ${answer.flag ? "bg-error/10" : ""}`}>
                      <div className="text-sm opacity-60">
                        {answer.label}
                        {answer.flag && <div className="text-xs text-error">{answer.flag}</div>}
                      </div>
                      <Prose>{answer.value}</Prose>
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}

          {staged.screenshot && (
            <>
              <Label>Filled form</Label>
              <img src={asset("screenshot")} alt="the filled application form"
                   className="w-full rounded-box border border-base-300 bg-white" />
            </>
          )}
        </Section>
      )}

      {posting.resume && (
        <Section title="Resume" sub={<Stamp>{posting.resume}</Stamp>}>
          <iframe src={asset("resume")} title="resume"
                  className="h-[780px] w-full rounded-box border border-base-300 bg-white" />
        </Section>
      )}

      <Section title="History">
        <DataTable
          head={[{ label: "When" }, { label: "Status" }, { label: "Note" }]}
          rows={found.events.map((event, index) => ({
            key: String(index),
            cells: [<Stamp key="w">{event.at}</Stamp>,
                    <Badge key="s">{event.status}</Badge>,
                    event.note],
          }))}
          empty="No history yet."
        />
      </Section>

      {posting.description && (
        <Section title="Description">
          <Card className="max-h-[28rem] overflow-auto"><Prose>{posting.description}</Prose></Card>
        </Section>
      )}
    </>
  );
}
