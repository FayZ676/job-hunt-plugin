import { notFound } from "next/navigation";
import { prospect, type Prospect } from "@/lib/queries";

export async function held(params: Promise<{ key: string }>): Promise<Prospect> {
  const { key } = await params;
  const found = prospect(decodeURIComponent(key));
  if (!found) notFound();
  return found;
}

export const assetAt = (kind: string, key: string) => `/asset/${kind}/${encodeURIComponent(key)}`;
