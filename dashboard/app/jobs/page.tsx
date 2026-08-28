import FilterableTable from "@/components/FilterableTable";
import { Badge, PageHeader, Out, Score, Stamp } from "@/components/ui";
import { jobs, stats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const ORDER = ["shortlisted", "staged", "applied", "interviewing", "new", "scored",
               "skipped", "rejected", "not_pursued", "closed"];

type Job = {
  key: string; company: string; title: string; location: string | null; remote: number;
  compensation: string | null; first_seen: string | null; score: number | null;
  status: string; resume: string | null;
};

export default function JobsPage() {
  const rows = jobs() as Job[];
  const counts = Object.fromEntries(stats().map((s) => [s.status, s.n]));

  return (
    <>
      <PageHeader
        title="Jobs"
        sub={`${rows.length} prospects, scored against your profile. Open one for the full posting,
              its history and the resume that was built for it.`}
      />
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
          facets: [job.status],
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
