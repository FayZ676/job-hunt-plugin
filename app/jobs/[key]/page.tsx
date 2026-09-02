import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Out, Prose, Score, ScreenHead, Section, Sheet, Split, Stamp } from "@/components/ui";
import { shortDate } from "@/components/format";
import { reading } from "@/components/status";
import { options, prospect } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

const PAPER = "pane w-full rounded-box border border-base-300 bg-white";

export default async function ProspectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = prospect(decodeURIComponent(key));
  if (!found) notFound();
  const { posting, staged } = found;

  const asset = (kind: string) => `/asset/${kind}/${encodeURIComponent(posting.key)}`;
  const papers = [posting.resume, staged?.screenshot].filter(Boolean).length;

  const facts = (
    <>
      <Section title="Opening">
        <Sheet
          readout
          label="9rem"
          bands={[
            {
              notes: [
                { label: "Location", value: posting.location || (posting.remote ? "Remote" : "—") },
                { label: "Compensation", value: posting.compensation || "—" },
                { label: "Posted", value: shortDate(posting.posted_at) },
                { label: "First seen", value: shortDate(posting.first_seen) },
                { label: "Source", value: posting.source || "—" },
                { label: "Posting", value: <Out href={posting.url}>open</Out> },
                found.aliases.length > 0 && {
                  label: "Also listed as",
                  value: <Stamp>{found.aliases.join(" · ")}</Stamp>,
                },
              ],
            },
          ]}
        />
      </Section>

      {found.events.length > 0 && (
        <Section title="History">
          <Sheet
            readout
            label="9rem"
            bands={[
              {
                notes: found.events.map((event) => ({
                  label: <Stamp>{event.at.slice(0, 16)}</Stamp>,
                  mark: reading(event.status).stage === "waiting",
                  value: (
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <Badge>{event.status}</Badge>
                      <span className="min-w-0 text-soft">{event.note}</span>
                    </span>
                  ),
                })),
              },
            ]}
          />
        </Section>
      )}
    </>
  );

  return (
    <>
      <ScreenHead
        kicker={
          <>
            <Link href="/jobs" className="transition-colors hover:text-base-content">
              Jobs
            </Link>
            <span aria-hidden className="mx-2 text-base-300">
              /
            </span>
            {posting.company}
          </>
        }
        headline={posting.title}
      >
        <p className="mt-2 flex items-center gap-3 text-sm">
          {posting.score !== null && <Score value={posting.score} />}
          <Badge>{posting.status}</Badge>
          <Stamp>{posting.key}</Stamp>
        </p>
      </ScreenHead>

      <Split pinned rail={facts}>
        {posting.reason && (
          <Section title="Why this score">
            <Card readout>
              <Prose>{posting.reason}</Prose>
            </Card>
          </Section>
        )}

        {staged && (
          <Section title="Staged application">
            <div className="space-y-4">
              <Sheet
                readout
                bands={[
                  {
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
                  },
                ]}
              />

              <Sheet
                readout
                bands={options("staged_fields", "tier")
                  .map((tier) => ({
                    label: tier,
                    notes: found.fields
                      .filter((field) => field.tier === tier)
                      .map((answer) => ({
                        label: answer.label,
                        value: <Prose>{answer.value}</Prose>,
                        flag: answer.flag,
                        mark: Boolean(answer.flag),
                      })),
                  }))
                  .filter((band) => band.notes.length > 0)}
              />
            </div>
          </Section>
        )}

        {posting.description && (
          <Section title="Description">
            <Card readout className="pane-max">
              <Prose>{posting.description}</Prose>
            </Card>
          </Section>
        )}
      </Split>

      {papers > 0 && (
        <div className="@container mt-8">
          <div className={`grid gap-x-6 ${papers > 1 ? "@5xl:grid-cols-2" : ""}`}>
            {posting.resume && (
              <Section title="Resume" sub={posting.resume}>
                <iframe src={asset("resume")} title="resume" className={PAPER} />
              </Section>
            )}
            {staged?.screenshot && (
              <Section title="Filled form">
                <img
                  src={asset("screenshot")}
                  alt="the filled application form"
                  className={`${PAPER} object-contain object-top`}
                />
              </Section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
