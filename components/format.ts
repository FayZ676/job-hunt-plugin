const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return iso ?? "—";
  const [, year, month, day] = match;
  const label = `${MONTHS[Number(month) - 1]} ${Number(day)}`;
  return Number(year) === new Date().getFullYear() ? label : `${label} ${year}`;
}

const thousands = (amount: number) => Math.round(amount / 1000);

const AMOUNT = /^\s*\$?([\d,]+)\s*(?:[-–—]\s*\$?([\d,]+))?\s*(.*)$/;

export function shortPay(raw: string | null | undefined) {
  if (!raw) return null;
  const match = AMOUNT.exec(raw);
  if (!match) return raw;
  const [, low, high, rest] = match;
  const start = Number(low.replace(/,/g, ""));
  if (!Number.isFinite(start) || start === 0) return raw;
  const end = high ? Number(high.replace(/,/g, "")) : null;
  if (/hour/i.test(rest)) {
    return end ? `$${low}–${high}/hr` : `$${low}/hr`;
  }
  const span = end ? `$${thousands(start)}–${thousands(end)}k` : `$${thousands(start)}k`;
  return span;
}

const ZIP = /,?\s+\d{5}(?:-\d{4})?\b/g;

export const shortPlace = (raw: string | null | undefined) => (raw ? raw.replace(ZIP, "") : raw);

export type When = { year: number; month: number | null };

export function when(raw: string | null | undefined): When | null {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(raw ?? "");
  if (!match) return null;
  return { year: Number(match[1]), month: match[2] ? Number(match[2]) : null };
}

export const whenLabel = (moment: When) =>
  moment.month ? `${MONTHS[moment.month - 1]} ${moment.year}` : String(moment.year);

const index = (moment: When) => moment.year * 12 + ((moment.month ?? 1) - 1);

export const monthsBetween = (from: When, to: When) => index(to) - index(from);

export const today = (): When => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export function lengthLabel(months: number) {
  if (months < 1) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${months} mo`;
  return rest ? `${years} yr ${rest} mo` : `${years} yr`;
}

export function spanLabel(start: When | null, finish: When | null, current: boolean) {
  const opened = start ? whenLabel(start) : null;
  const closed = current ? "now" : finish ? whenLabel(finish) : null;
  if (opened && closed) return `${opened} — ${closed}`;
  return opened ?? closed;
}
