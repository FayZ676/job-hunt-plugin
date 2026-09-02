"use server";

import { revalidatePath } from "next/cache";

import type { Since } from "../core/sources.ts";
import { type Found, search } from "../search.ts";

export type Ran = { found: Found } | { error: string };

export async function find(aim: {
  terms: string[];
  locations: string[];
  remote: boolean;
  since: Since;
  max: number;
}): Promise<Ran> {
  try {
    const found = await search(aim);
    revalidatePath("/", "layout");
    return { found };
  } catch (error) {
    return { error: String((error as Error).message).replace(/\s+/g, " ") };
  }
}
