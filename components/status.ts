import type { z } from "zod";
import {
  Check,
  Circle,
  CircleAlert,
  CircleDashed,
  CircleDot,
  MessagesSquare,
  Minus,
  Send,
  SkipForward,
  X,
  type LucideIcon,
} from "lucide-react";

import { TABLES, type Status } from "@/lib/core/schema";

type FormStatus = NonNullable<z.infer<typeof TABLES.staged.shape.status>>;

type Stage = "waiting" | "live" | "closed";

type Reading = { stage: Stage; rank: number; icon: LucideIcon };

const READINGS: Record<Status, Reading> = {
  shortlisted: { stage: "waiting", rank: 0, icon: CircleDot },
  staged: { stage: "waiting", rank: 1, icon: Send },
  interviewing: { stage: "live", rank: 2, icon: MessagesSquare },
  applied: { stage: "live", rank: 3, icon: Check },
  new: { stage: "live", rank: 4, icon: Circle },
  rejected: { stage: "closed", rank: 5, icon: X },
  passed: { stage: "closed", rank: 6, icon: Minus },
  skipped: { stage: "closed", rank: 7, icon: SkipForward },
};

const FORM_READINGS: Record<FormStatus, Reading> = {
  ready: { stage: "waiting", rank: 0, icon: Send },
  blocked: { stage: "waiting", rank: 1, icon: CircleAlert },
};

const UNKNOWN: Reading = { stage: "closed", rank: 99, icon: CircleDashed };

const ALL: Record<string, Reading> = { ...READINGS, ...FORM_READINGS };

export const reading = (status: string | null | undefined): Reading => (status && ALL[status]) || UNKNOWN;

export const label = (status: string) => status.replace(/_/g, " ");

export const ORDER = Object.keys(READINGS);

export const rankOf = (status: string | null | undefined) => reading(status).rank;
