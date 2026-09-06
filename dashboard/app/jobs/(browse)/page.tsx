import { rankOf } from "@/components/status";
import { jobs } from "@/lib/web/queries";
import JobsTable from "./JobsTable";

export const dynamic = "force-dynamic";

export default function JobsPage() {
  const rows = jobs()
    .slice()
    .sort(
      (left, right) =>
        rankOf(left.status) - rankOf(right.status) ||
        (right.score ?? -1) - (left.score ?? -1) ||
        (right.first_seen ?? "").localeCompare(left.first_seen ?? ""),
    );

  return <JobsTable rows={rows} />;
}
