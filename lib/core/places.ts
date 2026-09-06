import { norm } from "./text.ts";

const UNITED_STATES = "united states";
const UNITED_KINGDOM = "united kingdom";

const STATES = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
  "district of columbia",
];

const ABBREVIATIONS =
  "ak az ct dc fl ga hi ia id il ks ky ma me mi mn mo nc nd nh nj nm nv ny oh ok or ri tn tx ut va vt wa wi wv wy".split(
    " ",
  );

const AMERICAN = new Set([...STATES, ...ABBREVIATIONS]);

const ALIAS: Record<string, string> = {
  us: UNITED_STATES,
  usa: UNITED_STATES,
  "u s": UNITED_STATES,
  "u s a": UNITED_STATES,
  america: UNITED_STATES,
  "united states of america": UNITED_STATES,
  uk: UNITED_KINGDOM,
  "great britain": UNITED_KINGDOM,
  england: UNITED_KINGDOM,
  scotland: UNITED_KINGDOM,
  wales: UNITED_KINGDOM,
};

export function places(said: string | null | undefined): string[] {
  const parts = (said ?? "")
    .split(/[|,;/]/)
    .map((held) => norm(held))
    .filter(Boolean);

  const held = new Set<string>();
  for (const part of parts) {
    held.add(ALIAS[part] ?? part);
    if (AMERICAN.has(part)) held.add(UNITED_STATES);
  }
  return [...held];
}
