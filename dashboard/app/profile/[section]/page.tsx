import { notFound } from "next/navigation";
import { PANELS } from "../panels";
import { Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PanelPage({ params }: PageProps<"/profile/[section]">) {
  const { section } = await params;
  const panel = PANELS[section];
  if (!panel) notFound();

  return <Section title={panel.title} sub={panel.sub}>{panel.body()}</Section>;
}
