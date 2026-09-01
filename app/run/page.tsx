import Search from "./Search";
import { ScreenHead } from "@/components/ui";
import { SINCE } from "@/lib/core/sources";

export const dynamic = "force-dynamic";

export default function RunPage() {
  return (
    <div className="max-w-4xl">
      <ScreenHead headline="Search for openings" />
      <Search windows={SINCE} />
    </div>
  );
}
