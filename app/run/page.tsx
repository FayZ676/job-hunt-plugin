import Console from "./Console";
import { phases } from "@/lib/web/phases";

export const dynamic = "force-dynamic";

export default function RunPage() {
  return <Console phases={phases()} />;
}
