import FilterableTable from "@/components/FilterableTable";
import { payAmount, shortDate, shortPay, shortPlace } from "@/components/format";
import { ORDER, label, rankOf, reading } from "@/components/status";
import Glyph from "@/components/Glyph";
import { Badge, Out, Score, Stamp } from "@/components/ui";
import { jobs, stats } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

export default function JobsPage() {
  const tallies = stats().map((group) => ({ status: group.status ?? "", n: group.n }));
  const counts = Object.fromEntries(tallies.map((tally) => [tally.status, tally.n]));
  const rows = jobs()
    .slice()
    .sort(
      (left, right) =>
        rankOf(left.status) - rankOf(right.status) ||
        (right.score ?? -1) - (left.score ?? -1) ||
        (right.first_seen ?? "").localeCompare(left.first_seen ?? ""),
    );

  return (
    <FilterableTable
      placeholder="company, title or location"
      empty="Nothing scanned yet."
      head={[
        { label: "Company", width: "16%", sortable: true },
        { label: "Title", width: "26%", sortable: true },
        { label: "Score", width: "6%", numeric: true, sortable: true },
        { label: "Status", width: "12%", sortable: true },
        { label: "Location", width: "20%", hideNarrow: true, sortable: true },
        { label: "Pay", width: "8%", hideNarrow: true, numeric: true, sortable: true },
        { label: "Seen", width: "6%", hideNarrow: true, numeric: true, sortable: true },
        { label: "Resume", width: "6%", hideNarrow: true },
      ]}
      groups={[
        {
          name: "status",
          column: "Status",
          legend: "Filter openings by status",
          facets: ORDER.filter((status) => counts[status]).map((status) => ({
            key: status,
            label: label(status),
            count: counts[status],
            quiet: reading(status).stage === "closed",
            icon: <Glyph icon={reading(status).icon} />,
          })),
        },
      ]}
      rows={rows.map((job) => ({
        key: job.key,
        href: `/jobs/${encodeURIComponent(job.key)}`,
        mark: reading(job.status).stage === "waiting",
        facets: job.status ? [job.status] : [],
        haystack: `${job.company} ${job.title} ${job.location ?? ""}`,
        sort: [
          job.company,
          job.title,
          job.score,
          rankOf(job.status),
          shortPlace(job.location) || (job.remote ? "Remote" : null),
          payAmount(job.compensation),
          job.first_seen,
        ],
        cells: [
          <span key="c" className="font-medium">
            {job.company}
          </span>,
          job.title,
          <Score key="s" value={job.score} why={job.reason} />,
          <Badge key="b">{job.status}</Badge>,
          shortPlace(job.location) || (job.remote ? "Remote" : "—"),
          shortPay(job.compensation) ? (
            <span key="p" className="whitespace-nowrap">
              {shortPay(job.compensation)}
            </span>
          ) : (
            <span key="p" className="text-soft">
              —
            </span>
          ),
          <Stamp key="t">{shortDate(job.first_seen)}</Stamp>,
          job.resume ? (
            <Out key="r" href={`/asset/resume/${encodeURIComponent(job.key)}`}>
              Résumé
            </Out>
          ) : (
            <span key="r" className="text-soft">
              —
            </span>
          ),
        ],
      }))}
    />
  );
}
