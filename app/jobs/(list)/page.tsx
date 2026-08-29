import FilterableTable from "@/components/FilterableTable";
import { Badge, Out, Score, Stamp } from "@/components/ui";
import { jobs, stats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const ORDER = ["shortlisted", "staged", "applied", "interviewing", "new", "scored",
               "skipped", "rejected", "not_pursued", "closed"];

export default function JobsPage() {
  const rows = jobs();
  const counts = Object.fromEntries(stats().map((group) => [group.status ?? "", group.n]));

  return (
    <>
      <FilterableTable
        placeholder="company, title or location"
        empty="Nothing scanned yet. Run the job routine and they land here."
        head={[
          { label: "Company" }, { label: "Title" }, { label: "Score" }, { label: "Status" },
          { label: "Location", hideNarrow: true }, { label: "Compensation", hideNarrow: true },
          { label: "Seen", hideNarrow: true }, { label: "Resume", hideNarrow: true },
        ]}
        groups={[{
          name: "status",
          facets: ORDER.filter((status) => counts[status])
            .map((status) => ({ key: status, label: status, count: counts[status] })),
        }]}
        rows={rows.map((job) => ({
          key: job.key,
          href: `/jobs/${encodeURIComponent(job.key)}`,
          facets: job.status ? [job.status] : [],
          haystack: `${job.company} ${job.title} ${job.location ?? ""}`,
          cells: [
            <span key="c" className="font-medium hover:underline">{job.company}</span>,
            job.title,
            <Score key="s" value={job.score} />,
            <Badge key="b">{job.status}</Badge>,
            job.location || (job.remote ? "Remote" : "—"),
            job.compensation || "—",
            <Stamp key="t">{job.first_seen?.slice(0, 10)}</Stamp>,
            job.resume
              ? <Out key="r" href={`/asset/resume/${encodeURIComponent(job.key)}`}>open PDF</Out>
              : "—",
          ],
        }))}
      />
    </>
  );
}
