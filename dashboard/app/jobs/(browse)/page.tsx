import Actions from "@/components/Actions";
import { rankOf } from "@/components/status";
import { jobs } from "@/lib/queries";
import JobsTable from "./JobsTable";

export const dynamic = "force-dynamic";

export default function JobsPage() {
  const rows = jobs()
    .slice()
    .sort(
      (left, right) =>
        rankOf(left.status) - rankOf(right.status) ||
        (right.score ?? -1) - (left.score ?? -1) ||
        (right.last_updated ?? "").localeCompare(left.last_updated ?? ""),
    );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Actions ids={["search", "score", "cleanup"]} />
      </div>
      <JobsTable rows={rows} />
    </>
  );
}
