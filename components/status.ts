import type { z } from "zod";
import {
  Check,
  Circle,
  CircleAlert,
  CircleDashed,
  CircleDot,
  Gauge,
  Lock,
  MessagesSquare,
  Minus,
  Send,
  SkipForward,
  X,
  type LucideIcon,
} from "lucide-react";

import { TABLES, type Status } from "@/lib/core/schema";

type FormStatus = NonNullable<z.infer<typeof TABLES.staged.shape.status>>;

export type Stage = "waiting" | "live" | "closed";

type Reading = { label: string; stage: Stage; rank: number; icon: LucideIcon };

const READINGS: Record<Status, Reading> = {
  shortlisted: { label: "needs your call", stage: "waiting", rank: 0, icon: CircleDot },
  staged: { label: "ready to send", stage: "waiting", rank: 1, icon: Send },
  interviewing: { label: "interviewing", stage: "live", rank: 2, icon: MessagesSquare },
  applied: { label: "applied", stage: "live", rank: 3, icon: Check },
  scored: { label: "scored", stage: "live", rank: 4, icon: Gauge },
  new: { label: "new", stage: "live", rank: 5, icon: Circle },
  rejected: { label: "rejected", stage: "closed", rank: 6, icon: X },
  not_pursued: { label: "passed", stage: "closed", rank: 7, icon: Minus },
  skipped: { label: "skipped", stage: "closed", rank: 8, icon: SkipForward },
  closed: { label: "closed", stage: "closed", rank: 9, icon: Lock },
};

const FORM_READINGS: Record<FormStatus, Reading> = {
  ready: { label: "ready to send", stage: "waiting", rank: 0, icon: Send },
  blocked: { label: "blocked", stage: "waiting", rank: 1, icon: CircleAlert },
};

const UNKNOWN: Reading = { label: "unread", stage: "closed", rank: 99, icon: CircleDashed };

const ALL: Record<string, Reading> = { ...READINGS, ...FORM_READINGS };

export const reading = (status: string | null | undefined): Reading => (status && ALL[status]) || UNKNOWN;

export const ORDER = Object.keys(READINGS);

export const rankOf = (status: string | null | undefined) => reading(status).rank;
