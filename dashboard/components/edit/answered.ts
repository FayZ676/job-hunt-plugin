"use client";

export const answered = async <T,>(write: Promise<T>): Promise<T | { error: string }> => {
  try {
    return await write;
  } catch {
    return { error: "the server never answered — reload the page, then try again" };
  }
};
