import Console from "./Console";
import { actions } from "@/lib/web/actions";

export const dynamic = "force-dynamic";

const first = (held: string | string[] | undefined) => (Array.isArray(held) ? held[0] : held);

export default async function RunPage({ searchParams }: PageProps<"/run">) {
  const asked = await searchParams;
  const action = first(asked.run);
  const known = actions();

  return (
    <Console
      actions={known}
      opening={action && known.some((held) => held.id === action) ? { action, argument: first(asked.key) ?? "" } : null}
    />
  );
}
