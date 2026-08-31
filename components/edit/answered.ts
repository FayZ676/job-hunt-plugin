"use client";

import type { Saved } from "@/lib/web/actions";

export const answered = async (write: Promise<Saved>): Promise<Saved> => {
  try {
    return await write;
  } catch {
    return { error: "the server never answered — reload the page, then try again" };
  }
};
