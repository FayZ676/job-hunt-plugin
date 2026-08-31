import Link from "next/link";
import { notFound } from "next/navigation";
import Ledger from "@/components/Ledger";
import {
  Badge, Card, Out, Prose, Score, ScreenHead, Section, Sheet, Stamp,
} from "@/components/ui";
import { shortDate } from "@/components/format";
import { reading } from "@/components/status";
import { prospect } from "@/lib/web/queries";

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
      <Link href="/jobs"
            className="text-sm text-soft underline decoration-base-300 underline-offset-2
              transition-colors hover:text-base-content hover:decoration-current">
        ← Jobs
      </Link>
      <ScreenHead kicker={posting.company} headline={posting.title}>
        <p className="mt-2 flex items-center gap-3 text-sm">
          <Score value={posting.score} />
          <Badge>{posting.status}</Badge>
          <Stamp>{posting.key}</Stamp>
        </p>
      </ScreenHead>

      <Section title="Opening">
        <Sheet bands={[{
          notes: [
            { label: "Location", value: posting.location || (posting.remote ? "Remote" : "—") },
            { label: "Compensation", value: posting.compensation || "—" },
            { label: "Posted", value: shortDate(posting.posted_at) },
            { label: "First seen", value: shortDate(posting.first_seen) },
            { label: "Source", value: posting.source || "—" },
            { label: "Posting", value: <Out href={posting.url}>open</Out> },
            found.aliases.length > 0 && {
              label: "Also listed as", value: <Stamp>{found.aliases.join(" · ")}</Stamp>,
            },
          ],
        }]} />
      </Section>

      {posting.reason && (
        <Section title="Why this score">
          <Card><Prose>{posting.reason}</Prose></Card>
        </Section>
      )}

      {staged && (
        <Section title="Staged application">
          <div className="space-y-4">
            <Sheet bands={[{
              notes: [
                {
                  label: "Form status",
                  value: <Badge>{staged.status}</Badge>,
                  mark: reading(staged.status).stage === "waiting",
                },
                { label: "Apply URL", value: <Out href={staged.url}>open</Out> },
                staged.blocked_on !== null && {
                  label: "Blocked on",
                  value: <span className="text-error">{staged.blocked_on}</span>,
                  mark: true,
                },
              ],
            }]} />

            <Sheet bands={TIERS.map((tier) => ({
              label: tier,
              notes: found.fields.filter((field) => field.tier === tier).map((answer) => ({
                label: answer.label,
                value: <Prose>{answer.value}</Prose>,
                flag: answer.flag,
                mark: Boolean(answer.flag),
              })),
            })).filter((band) => band.notes.length > 0)} />

            {staged.screenshot && (
              <div>
                <h3 className="eyebrow mb-2">Filled form</h3>
                <img src={asset("screenshot")} alt="the filled application form"
                     className="w-full rounded-box border border-base-300 bg-white" />
              </div>
            )}
          </div>
        </Section>
      )}

      {posting.resume && (
        <Section title="Resume" sub={posting.resume}>
          <iframe src={asset("resume")} title="resume"
                  className="h-[780px] w-full rounded-box border border-base-300 bg-white" />
        </Section>
      )}

      <Section title="History">
        <Ledger
          head={[{ label: "When", width: "22%" },
                 { label: "Status", width: "22%" },
                 { label: "Note" }]}
          rows={found.events.map((event, index) => ({
            key: String(index),
            mark: reading(event.status).stage === "waiting",
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
