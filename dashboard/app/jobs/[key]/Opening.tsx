import Link from "next/link";
import { ChevronLeft, CircleAlert } from "lucide-react";
import Actions from "@/components/Actions";
import CopyKey from "./CopyKey";
import Glyph from "@/components/Glyph";
import { Badge, Out, Sheet, Stamp, fitTone } from "@/components/ui";
import { shortDate } from "@/components/format";
import { offered } from "@/core/actions";
import type { Prospect } from "@/lib/web/queries";

const Fit = ({ score, why }: { score: number | null; why: string | null }) => {
  if (score === null && !why) return <p className="mt-4 text-sm text-soft">Not scored yet.</p>;

  return (
    <div className="mt-4 flex gap-4">
      <p className="w-8 shrink-0 text-center">
        <span className={`tnum block font-display text-2xl leading-none ${fitTone(score)}`}>{score ?? "—"}</span>
        <span className="eyebrow mt-1 block">fit</span>
      </p>
      {why && <p className="max-h-36 max-w-[76ch] overflow-auto text-sm leading-6">{why}</p>}
    </div>
  );
};

const Blocked = ({ on }: { on: string }) => (
  <p className="mt-3 flex items-start gap-2 rounded-field border border-error/40 px-2.5 py-1.5 text-xs text-error">
    <Glyph icon={CircleAlert} className="mt-px" />
    <span className="min-w-0">Blocked on {on}</span>
  </p>
);

const elsewhere = (status: Prospect["posting"]["status"]) =>
  offered(status)
    .map((action) => action.id)
    .filter((id) => id !== "resume");

export default function Opening({ found }: { found: Prospect }) {
  const { posting, staged, aliases } = found;

  return (
    <header className="mb-6">
      <Link
        href="/jobs"
        className="-ml-2 mb-1 inline-flex items-center gap-1 rounded-field px-2 py-1 text-sm
        text-soft transition-colors hover:bg-base-200 hover:text-base-content"
      >
        <Glyph icon={ChevronLeft} size={15} />
        All jobs
      </Link>

      <div className="@container overflow-hidden rounded-box border border-base-300 bg-base-100">
        <div className="grid @4xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="min-w-0 p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-medium">{posting.company}</span>
              <Badge>{posting.status}</Badge>
            </div>

            <h1 className="mt-1 font-display text-2xl font-medium leading-tight md:text-3xl">{posting.title}</h1>

            {staged?.blocked_on && <Blocked on={staged.blocked_on} />}

            <Fit score={posting.score} why={posting.reason} />
          </div>

          <div className="border-t border-base-300 @4xl:border-l @4xl:border-t-0">
            <Sheet
              flush
              label="7rem"
              bands={[
                {
                  notes: [
                    { label: "Location", value: posting.location || (posting.remote ? "Remote" : "—") },
                    { label: "Compensation", value: posting.compensation || "—" },
                    { label: "Posted", value: shortDate(posting.posted_at) },
                    { label: "First seen", value: shortDate(posting.first_seen) },
                    { label: "Posting", value: <Out href={posting.url}>{posting.source || "open"}</Out> },
                    aliases.length > 0 && {
                      label: "Also listed as",
                      value: (
                        <span className="flex max-h-20 flex-col overflow-auto leading-5">
                          {aliases.map((alias) => (
                            <Stamp key={alias}>{alias}</Stamp>
                          ))}
                        </span>
                      ),
                    },
                  ],
                },
              ]}
            />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-base-300
          px-4 py-2.5 md:px-5"
        >
          <Actions ids={elsewhere(posting.status)} argument={posting.key} />
          <span className="ml-auto">
            <CopyKey jobKey={posting.key} />
          </span>
        </div>
      </div>
    </header>
  );
}
