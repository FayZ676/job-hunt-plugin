import Link from "next/link";
import Actions from "./Actions";
import { notFound } from "next/navigation";
import { Badge, Card, Out, Prose, Score, ScreenHead, Section, Sheet, Split, Stamp } from "@/components/ui";
import { shortDate } from "@/components/format";
import { reading } from "@/components/status";
import { prospect } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

const PAPER = "pane w-full rounded-box border border-base-300 bg-white";

export default async function ProspectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = prospect(decodeURIComponent(key));
  if (!found) notFound();
  const { posting, staged } = found;

  const asset = (kind: string) => `/asset/${kind}/${encodeURIComponent(posting.key)}`;

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
          {posting.score !== null && <Score value={posting.score} why={posting.reason} />}
          <Badge>{posting.status}</Badge>
          <Stamp>{posting.key}</Stamp>
        </p>
      </ScreenHead>

      <Split pinned rail={facts}>
        <Actions jobKey={posting.key} status={posting.status} />

        {staged && (
          <Section title="Staged application">
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
          </Section>
        )}

        {posting.description && (
          <Section title="Description">
            <Card readout className="pane-max">
              <Prose className="max-w-[72ch]">{posting.description}</Prose>
            </Card>
          </Section>
        )}
      </Split>

      {posting.resume && (
        <div className="mt-8">
          <Section title="Resume" sub={posting.resume}>
            <iframe src={asset("resume")} title="resume" className={PAPER} />
          </Section>
        </div>
      )}
    </>
  );
}
