import { MAX_DESCRIPTION_CHARS, htmlToText } from "../text.ts";

export const REMOTE = /\bremote\b|\banywhere\b|\bwork from home\b|\bdistributed\b/i;

const capped = (text: string) => (text ? text.slice(0, MAX_DESCRIPTION_CHARS) : null);

export const said = (raw: string | null | undefined) => capped(htmlToText(raw));

export const wrote = (raw: string | null | undefined) => capped((raw ?? "").trim());

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const slug = (held: string) => {
  const bare = held.trim().toLowerCase().replace(/\s+/g, "-");
  return SLUG.test(bare) ? bare : null;
};

export const titled = (held: string) =>
  held
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

export const fromUrl = (said: string, host: RegExp, path: RegExp) => {
  let url: URL;
  try {
    url = new URL(said);
  } catch {
    return null;
  }
  if (!host.test(url.hostname)) return null;
  return path.exec(url.pathname)?.[1] ?? null;
};
