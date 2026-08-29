const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const span = end
    ? `$${thousands(start)}–${thousands(end)}k`
    : `$${thousands(start)}k`;
  return span;
}

const ZIP = /,?\s+\d{5}(?:-\d{4})?\b/g;

export const shortPlace = (raw: string | null | undefined) =>
  raw ? raw.replace(ZIP, "") : raw;
