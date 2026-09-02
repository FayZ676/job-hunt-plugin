import Console from "./Console";
import { phases } from "@/lib/web/phases";

export const dynamic = "force-dynamic";

const first = (held: string | string[] | undefined) => (Array.isArray(held) ? held[0] : held);

export default async function RunPage({ searchParams }: PageProps<"/run">) {
  const asked = await searchParams;
  const phase = first(asked.run);
  const known = phases();

  return (
    <Console
      phases={known}
      opening={phase && known.some((held) => held.id === phase) ? { phase, argument: first(asked.key) ?? "" } : null}
    />
  );
}
