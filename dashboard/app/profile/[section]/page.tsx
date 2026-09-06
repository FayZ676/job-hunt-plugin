import { notFound } from "next/navigation";
import { PANELS } from "../panels";

export const dynamic = "force-dynamic";

export default async function PanelPage({ params }: PageProps<"/profile/[section]">) {
  const { section } = await params;
  const panel = PANELS[section];
  if (!panel) notFound();

  return panel.body();
}
