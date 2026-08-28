import { decodeHTML } from "entities";

export const MAX_DESCRIPTION_CHARS = 20000;

const INLINE_FLAGS = /\(\?([imsx]+)\)/g;

export function compile(pattern: string) {
  let flags = "";
  const source = pattern.replace(INLINE_FLAGS, (_, held: string) => {
    for (const flag of held) if ("ims".includes(flag) && !flags.includes(flag)) flags += flag;
    return "";
  });
  return new RegExp(source, flags);
}

export const compilePatterns = (patterns: string[] | null | undefined) =>
  (patterns ?? []).map(compile);

export const matchesAny = (patterns: RegExp[], text: string | null | undefined) =>
  patterns.some((pattern) => pattern.test(text ?? ""));

export const norm = (text: string | null | undefined) =>
  (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const COMPANY_SUFFIXES =
  /[,.]?\s*\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology|labs|holdings|group|usa)\b\.?/gi;

export const normCompany = (name: string | null | undefined) =>
  norm((name ?? "").replace(COMPANY_SUFFIXES, ""));

export function htmlToText(raw: string | null | undefined) {
  if (!raw) return "";
  let text = decodeHTML(String(raw));
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "- ");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeHTML(text);
  text = text.replace(/ /g, " ").replace(/[ \t\r\f\v]+/g, " ");
  text = text.split("\n").map((line) => line.trim()).join("\n");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

const ISO =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?\s*(Z|[+-]\d{2}:?\d{2})?$/;

const offset = (held: string | undefined) => {
  if (!held) return "";
  if (held === "Z") return "+00:00";
  return held.includes(":") ? held : `${held.slice(0, 3)}:${held.slice(3)}`;
};

export function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (typeof value === "number" || /^\d+$/.test(text)) {
    const seconds = Number(text);
    const moment = new Date(seconds > 1e11 ? seconds : seconds * 1000);
    if (Number.isNaN(moment.getTime())) return null;
    const [, stamp, fraction] = /^(.*?)(?:\.(\d{3}))?Z$/.exec(moment.toISOString())!;
    return `${stamp}${fraction && fraction !== "000" ? `.${fraction}000` : ""}+00:00`;
  }
  const held = ISO.exec(text);
  if (held) {
    let time = held[2] ?? "00:00:00";
    if (time.length === 5) time += ":00";
    time = time.replace(/\.(\d+)$/, (whole, digits: string) =>
      /^0+$/.test(digits) ? "" : `.${digits.padEnd(6, "0").slice(0, 6)}`);
    return `${held[1]}T${time}${offset(held[3])}`;
  }
  const moment = new Date(text);
  return Number.isNaN(moment.getTime()) ? text : moment.toISOString();
}

export function ageDays(postedAt: string | null | undefined) {
  if (!postedAt) return null;
  const text = String(postedAt);
  const naive = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+)?$/.test(text);
  const moment = new Date(naive ? `${text.replace(" ", "T")}Z` : text);
  if (Number.isNaN(moment.getTime())) return null;
  return Math.floor((Date.now() - moment.getTime()) / 86400000);
}
