import Actions from "@/components/Actions";
import { rankOf } from "@/components/status";
import { describes } from "@/core/actions";
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
        (right.last_updated ?? "").localeCompare(left.last_updated ?? ""),
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <p className="text-sm text-soft">{describes("search")}</p>
        <Actions ids={["search"]} />
      </div>
      <JobsTable rows={rows} />
    </>
  );
}
