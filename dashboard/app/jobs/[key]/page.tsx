import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge, Card, DataTable, DefList, Label, Out, PageHeader, Prose, Score, Section, Stamp,
} from "@/components/ui";
import { prospect } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TIERS = ["identity", "policy", "judgment"] as const;

export default async function ProspectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = prospect(decodeURIComponent(key));
  if (!found) notFound();
  const { posting, staged } = found;

  const asset = (kind: string) => `/asset/${kind}/${encodeURIComponent(String(posting.key))}`;

  return (
    <>
      <Link href="/jobs" className="text-sm text-accent hover:underline">← Jobs</Link>
      <PageHeader
        title={`${posting.company} — ${posting.title}`}
        sub={
          <span className="flex items-center gap-2">
            <Score value={posting.score as number | null} /> ·
            <Badge>{posting.status as string}</Badge> ·
            <Stamp>{String(posting.key)}</Stamp>
          </span>
        }
      />

      <Card className="mb-8">
        <DefList pairs={[
          ["Location", String(posting.location || (posting.remote ? "Remote" : "—"))],
          ["Compensation", String(posting.compensation || "—")],
          ["Posted", String(posting.posted_at || "—")],
          ["First seen", String(posting.first_seen || "—")],
          ["Source", `${posting.source || "—"}${posting.ats ? ` · ${posting.ats}` : ""}`],
          ["Posting", <Out key="u" href={posting.url as string | null}>open</Out>],
          ["Apply", <Out key="a" href={posting.apply_url as string | null}>open</Out>],
          found.aliases.length > 0 && ["Also listed as", <Stamp key="x">{found.aliases.join(" · ")}</Stamp>],
        ]} />
      </Card>

      {posting.reason && (
        <Section title="Why this score">
          <Card><Prose>{String(posting.reason)}</Prose></Card>
        </Section>
      )}

      {staged && (
        <Section title="Staged application">
          <Card className="mb-4">
            <DefList pairs={[
              ["Form status", <Badge key="s">{staged.status as string}</Badge>],
              ["ATS", String(staged.ats || "—")],
              ["Apply URL", <Out key="u" href={staged.url as string | null}>open</Out>],
              staged.blocked_on !== null &&
                ["Blocked on", <span key="b" className="text-bad">{String(staged.blocked_on)}</span>],
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
                         className={`grid gap-1 border-b border-line p-3 last:border-0
                           sm:grid-cols-[14rem_minmax(0,1fr)] ${answer.flag ? "bg-bad-soft" : ""}`}>
                      <div className="text-sm text-dim">
                        {String(answer.label)}
                        {answer.flag && <div className="text-xs text-bad">{String(answer.flag)}</div>}
                      </div>
                      <Prose>{String(answer.value ?? "")}</Prose>
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
                   className="w-full rounded-xl border border-line bg-white" />
            </>
          )}
        </Section>
      )}

      {posting.resume && (
        <Section title="Resume" sub={<Stamp>{String(posting.resume)}</Stamp>}>
          <iframe src={asset("resume")} title="resume"
                  className="h-[780px] w-full rounded-xl border border-line bg-white" />
        </Section>
      )}

      <Section title="History">
        <DataTable
          head={[{ label: "When" }, { label: "Status" }, { label: "Note" }]}
          rows={found.events.map((event, index) => ({
            key: String(index),
            cells: [<Stamp key="w">{String(event.at)}</Stamp>,
                    <Badge key="s">{event.status as string}</Badge>,
                    String(event.note ?? "")],
          }))}
          empty="No history yet."
        />
      </Section>

      {posting.description && (
        <Section title="Description">
          <Card className="max-h-[28rem] overflow-auto"><Prose>{String(posting.description)}</Prose></Card>
        </Section>
      )}
    </>
  );
}
