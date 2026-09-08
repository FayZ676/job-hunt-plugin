const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return iso ?? "—";
  const [, year, month, day] = match;
  const label = `${MONTHS[Number(month) - 1]} ${Number(day)}`;
  return Number(year) === new Date().getFullYear() ? label : `${label} ${year}`;
}

const thousands = (amount: number) => Math.round(amount / 1000);

const MONEY =
  /^\s*([A-Z]{0,3}\$|[£€])?\s*([\d,]+(?:\.\d+)?)\s*([KkMm])?\s*(?:(?:[-–—]|to)\s*(?:[A-Z]{0,3}\$|[£€])?\s*([\d,]+(?:\.\d+)?)\s*([KkMm])?)?\s*([\s\S]*)$/;

const scale = (amount: number, unit: string | undefined) =>
  unit ? amount * (unit.toLowerCase() === "k" ? 1_000 : 1_000_000) : amount;

type Money = { sign: string; low: number; high: number | null; hourly: boolean };

function money(raw: string | null | undefined): Money | null {
  const found = MONEY.exec(raw ?? "");
  if (!found) return null;
  const [, sign, lowText, lowUnit, highText, highUnit, rest] = found;
  const low = scale(Number(lowText.replace(/,/g, "")), lowUnit);
  if (!Number.isFinite(low) || low === 0) return null;
  const high = highText ? scale(Number(highText.replace(/,/g, "")), highUnit ?? lowUnit) : null;
  return {
    sign: sign ?? "$",
    low,
    high: high !== null && Number.isFinite(high) ? high : null,
    hourly: /\bhour|\bhr\b|\/hr/i.test(rest),
  };
}

export function shortPay(raw: string | null | undefined) {
  if (!raw) return null;
  const found = money(raw);
  if (!found) return raw.split("•")[0].trim() || raw;
  const { sign, low, high, hourly } = found;
  if (hourly) return high ? `${sign}${low}–${high}/hr` : `${sign}${low}/hr`;
  return high ? `${sign}${thousands(low)}–${thousands(high)}k` : `${sign}${thousands(low)}k`;
}

const ZIP = /,?\s+\d{5}(?:-\d{4})?\b/g;
const APART = /\s*[|;]\s*|\s+•\s+/;

export function places(raw: string | null | undefined) {
  const list = (raw ?? "")
    .replace(ZIP, "")
    .split(APART)
    .map((part) => part.trim())
    .filter(Boolean);
  return { full: list.join(" | "), lead: list[0] ?? "", more: list.length - 1 };
}

export type When = { year: number; month: number | null };

export function when(raw: string | null | undefined): When | null {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(raw ?? "");
  if (!match) return null;
  return { year: Number(match[1]), month: match[2] ? Number(match[2]) : null };
}

const whenLabel = (moment: When) =>
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

export function payAmount(raw: string | null | undefined) {
  const found = money(raw);
  if (!found) return null;
  return found.hourly ? found.low * 2080 : found.low;
}
