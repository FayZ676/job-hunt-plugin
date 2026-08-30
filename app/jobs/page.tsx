import FilterableTable from "@/components/FilterableTable";
import Rail from "@/components/Rail";
import { shortDate, shortPay, shortPlace } from "@/components/format";
import { ORDER, rankOf, reading } from "@/components/status";
import { Badge, Out, Score, ScreenHead, Stamp } from "@/components/ui";
import { jobs, stats } from "@/lib/queries";

export const dynamic = "force-dynamic";

function headline(waiting: number, ready: number) {
  if (waiting > 0) {
    return <>
      <span className="tnum">{waiting}</span>
      {waiting === 1 ? " opening needs" : " openings need"} your call.
    </>;
  }
  if (ready > 0) {
    return <>
      Nothing new to judge. <span className="tnum">{ready}</span>
      {ready === 1 ? " application is" : " applications are"} filled and waiting to send.
    </>;
  }
  return <>Nothing is waiting on you.</>;
}

export default function JobsPage() {
  const tallies = stats().map((group) => ({ status: group.status ?? "", n: group.n }));
  const counts = Object.fromEntries(tallies.map((tally) => [tally.status, tally.n]));
  const count = (status: string) => counts[status] ?? 0;
  const rows = jobs().slice().sort((left, right) =>
    rankOf(left.status) - rankOf(right.status) ||
    (right.score ?? -1) - (left.score ?? -1) ||
    (right.first_seen ?? "").localeCompare(left.first_seen ?? ""));

  return (
    <>
      <ScreenHead kicker="Jobs" headline={headline(count("shortlisted"), count("staged"))}>
        <Rail tallies={tallies} />
      </ScreenHead>
      <FilterableTable
        placeholder="company, title or location"
        empty="Nothing scanned yet. Run the job routine and openings land here."
        head={[
          { label: "Company" }, { label: "Title" }, { label: "Score", numeric: true },
          { label: "Status" }, { label: "Location", hideNarrow: true },
          { label: "Pay", hideNarrow: true, numeric: true },
          { label: "Seen", hideNarrow: true }, { label: "Resume", hideNarrow: true },
        ]}
        groups={[{
          name: "status",
          legend: "Filter openings by status",
          facets: ORDER.filter((status) => counts[status]).map((status) => ({
            key: status,
            label: reading(status).label,
            count: counts[status],
            quiet: reading(status).stage === "closed",
          })),
        }]}
        rows={rows.map((job) => ({
          key: job.key,
          href: `/jobs/${encodeURIComponent(job.key)}`,
          facets: job.status ? [job.status] : [],
          haystack: `${job.company} ${job.title} ${job.location ?? ""}`,
          cells: [
            <span key="c" className="font-medium">{job.company}</span>,
            job.title,
            <Score key="s" value={job.score} />,
            <Badge key="b">{job.status}</Badge>,
            shortPlace(job.location) || (job.remote ? "Remote" : "—"),
            shortPay(job.compensation)
              ? <span key="p" className="whitespace-nowrap">{shortPay(job.compensation)}</span>
              : <span key="p" className="text-soft">—</span>,
            <Stamp key="t">{shortDate(job.first_seen)}</Stamp>,
            job.resume
              ? <Out key="r" href={`/asset/resume/${encodeURIComponent(job.key)}`}>Résumé</Out>
              : <span key="r" className="text-soft">—</span>,
          ],
        }))}
        />
    </>
  );
}
