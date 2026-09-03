import Console from "./Console";
import { ACTIONS, runnable } from "@/lib/core/actions";

export const dynamic = "force-dynamic";

const first = (held: string | string[] | undefined) => (Array.isArray(held) ? held[0] : held);

export default async function RunPage({ searchParams }: PageProps<"/run">) {
  const asked = await searchParams;
  const action = first(asked.run);

  return (
    <Console
      actions={ACTIONS}
      opening={action && runnable(action) ? { action, argument: first(asked.key) ?? "" } : null}
    />
  );
}
