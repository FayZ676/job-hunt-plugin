import { MAX_DESCRIPTION_CHARS, htmlToText, toIso } from "./text.ts";
import { type Posting, posting } from "./posting.ts";

export const VIEWJOB = "https://www.indeed.com/viewjob?jk=";

export const CARDS =
  "window.mosaic.providerData['mosaic-provider-jobcards'].metaData.mosaicProviderJobCardsModel.results";

type Card = Record<string, any>;

const cards = (payload: unknown): Card[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const held = payload as Record<string, any>;
    if (Array.isArray(held.results)) return held.results.flatMap((block: any) => block?.rows ?? []);
    if (Array.isArray(held.rows)) return held.rows;
  }
  throw new Error(
    `harvest holds no job cards — it should be ${CARDS}, ` +
      "saved either as that array or as {results:[{query,location,rows}]}",
  );
};

const band = (salary: Card) => {
  const low = salary.min ?? null;
  const high = salary.max ?? null;
  if (!low && !high) return null;
  const unit = String(salary.type ?? "").toLowerCase();
  const said = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return (low && high ? `${said(low)}-${said(high)} ${unit}` : `${said(low ?? high)} ${unit}`).trim();
};

export function harvested(payload: unknown): Posting[] {
  const held = cards(payload);
  const out: Posting[] = [];
  for (const card of held) {
    const jobkey = card.jobkey;
    if (!jobkey) continue;
    const salary = card.extractedSalary ?? {};
    const location = card.formattedLocation ?? "";
    const remote = card.remoteWorkModel?.type ?? "";
    out.push(
      posting({
        key: `indeed:${jobkey}`,
        source: "indeed",
        company: card.company ?? "",
        title: card.title ?? "",
        url: VIEWJOB + jobkey,
        location,
        remote: Boolean(remote) || /remote/i.test(location),
        compensation: band(salary),
        comp_min: salary.min,
        comp_max: salary.max,
        comp_period: salary.type,
        expired: card.expired,
        posted_at: toIso(card.pubDate),
        description: htmlToText(card.jobDescription).slice(0, MAX_DESCRIPTION_CHARS) || null,
        raw: JSON.stringify(card),
      }),
    );
  }
  return out;
}

export const described = (payload: unknown) => {
  const held = Array.isArray(payload) ? payload : ((payload as any)?.results ?? []);
  return held.flatMap((one: Card) =>
    one?.jobkey && one?.description
      ? [
          {
            key: `indeed:${one.jobkey}`,
            description: htmlToText(one.description).slice(0, MAX_DESCRIPTION_CHARS),
          },
        ]
      : [],
  );
};
