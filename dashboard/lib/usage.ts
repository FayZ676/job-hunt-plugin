import fs from "node:fs";
import path from "node:path";

import { CAREER } from "job/db";

export type Span = { used: number; resets: number };
export type Usage = { five: Span; week: Span | null; at: number };

const SNAPSHOT = path.join(CAREER, "usage.json");

const span = (held: unknown): Span | null => {
  const { used_percentage: used, resets_at: resets } = (held ?? {}) as Record<string, unknown>;
  if (typeof used !== "number" || typeof resets !== "number") return null;
  return { used, resets };
};

export function usage(): Usage | null {
  try {
    const at = fs.statSync(SNAPSHOT).mtimeMs;
    const limits = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")).rate_limits;
    const five = span(limits?.five_hour);
    return five && { five, week: span(limits?.seven_day), at };
  } catch {
    return null;
  }
}
