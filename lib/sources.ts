import path from "node:path";

import { ROOT } from "./root.ts";
import { MAX_DESCRIPTION_CHARS, htmlToText, toIso } from "./text.ts";
import { posting, type Posting } from "./posting.ts";

const ACTOR = "fantastic-jobs~career-site-job-listing-api";
const RUN = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`;

type Json = Record<string, any>;

export const SINCE = ["1h", "24h", "7d", "6m"] as const;
export type Since = (typeof SINCE)[number];

export type Search = {
  titles: string[]; notTitles: string[]; notOrganizations: string[];
  locations: string[]; remote: boolean; since: Since; max: number;
};

function token(): string {
  const held = process.env.APIFY_TOKEN?.trim();
  if (!held)
    throw new Error(
      "APIFY_TOKEN is not set. Get a token from apify.com/settings/integrations and put " +
      `APIFY_TOKEN=… in ${path.join(ROOT, ".env.local")}`);
  return held;
}

const PERIOD: Record<string, string> = {
  HOUR: "HOURLY", DAY: "DAILY", WEEK: "WEEKLY", MONTH: "MONTHLY", YEAR: "YEARLY",
};

const REMOTE = new Set(["Remote OK", "Remote Solely"]);

const pay = (item: Json) => ({
  min: item.ai_salary_min_value ?? item.ai_salary_value ?? null,
  max: item.ai_salary_max_value ?? item.ai_salary_value ?? null,
});

const band = (item: Json) => {
  if (typeof item.salary === "string" && item.salary.trim()) return item.salary.trim();
  const { min, max } = pay(item);
  if (min == null && max == null) return null;
  const currency = item.ai_salary_currency ?? "";
  const unit = String(item.ai_salary_unit_text ?? "").toLowerCase();
  const range = min != null && max != null && min !== max ? `${min}-${max}` : `${min ?? max}`;
  return `${range} ${currency}${unit ? ` per ${unit}` : ""}`.trim();
};

const where = (item: Json) => {
  const derived: string[] = item.locations_derived ?? [];
  if (derived.length) return derived.join(" | ");
  const remote: string[] = item.ai_remote_location_derived ?? item.ai_remote_location ?? [];
  if (remote.length) return remote.join(" | ");
  return REMOTE.has(item.ai_work_arrangement) ? "Remote" : "";
};

export function fromApify(items: Json[]): Posting[] {
  return items
    .filter((item) => item.id && item.title && item.organization)
    .map((item) => {
      const source = String(item.source ?? "ats");
      const money = pay(item);
      const location = where(item);
      const valid = toIso(item.date_valid_through);
      const written = String(item.description_text ?? "").trim()
        || htmlToText(String(item.description_html ?? ""));
      return posting({
        key: `${source}:${item.id}`,
        source,
        company: item.organization,
        title: item.title,
        url: item.url,
        location,
        remote: REMOTE.has(item.ai_work_arrangement) || /remote/i.test(location),
        compensation: band(item),
        comp_min: money.min,
        comp_max: money.max,
        comp_period: PERIOD[String(item.ai_salary_unit_text ?? "").toUpperCase()] ?? null,
        expired: Boolean(valid && Date.parse(valid) < Date.now()),
        posted_at: toIso(item.date_posted ?? item.date_created),
        description: written ? written.slice(0, MAX_DESCRIPTION_CHARS) : null,
        raw: JSON.stringify(item),
      });
    });
}

const some = (key: string, values: string[]) => (values.length ? { [key]: values } : {});

export async function search(aim: Search): Promise<Posting[]> {
  const answered = await fetch(RUN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify({
      timeRange: aim.since,
      limit: aim.max,
      descriptionType: "text",
      includeCompanyDetails: false,
      removeAgency: true,
      populateAiRemoteLocation: true,
      populateAiRemoteLocationDerived: true,
      ...(aim.remote ? { aiWorkArrangementFilter: [...REMOTE] } : {}),
      ...some("titleSearch", aim.titles),
      ...some("titleExclusionSearch", aim.notTitles),
      ...some("organizationExclusionSearch", aim.notOrganizations),
      ...some("locationSearch", aim.locations),
    }),
    signal: AbortSignal.timeout(600000),
  });
  if (!answered.ok)
    throw new Error(
      `HTTP ${answered.status} ${answered.statusText}: ${(await answered.text()).slice(0, 200)}`);
  const items = await answered.json();
  return fromApify(Array.isArray(items) ? items : []);
}
