export type Stage = "waiting" | "live" | "closed";

type Reading = { label: string; stage: Stage; rank: number };

const READINGS: Record<string, Reading> = {
  shortlisted: { label: "needs your call", stage: "waiting", rank: 0 },
  staged: { label: "ready to send", stage: "waiting", rank: 1 },
  interviewing: { label: "interviewing", stage: "live", rank: 2 },
  applied: { label: "applied", stage: "live", rank: 3 },
  scored: { label: "scored", stage: "live", rank: 4 },
  new: { label: "new", stage: "live", rank: 5 },
  rejected: { label: "rejected", stage: "closed", rank: 6 },
  not_pursued: { label: "passed", stage: "closed", rank: 7 },
  skipped: { label: "skipped", stage: "closed", rank: 8 },
  closed: { label: "closed", stage: "closed", rank: 9 },
};

const FORM_READINGS: Record<string, Reading> = {
  ready: { label: "ready to send", stage: "waiting", rank: 0 },
  blocked: { label: "blocked", stage: "waiting", rank: 1 },
};

const UNKNOWN: Reading = { label: "unread", stage: "closed", rank: 99 };

export const reading = (status: string | null | undefined): Reading =>
  (status && (READINGS[status] ?? FORM_READINGS[status])) || UNKNOWN;

export const ORDER = Object.keys(READINGS);

export const rankOf = (status: string | null | undefined) => reading(status).rank;
