import { z } from "zod";

import { TABLES, options } from "./schema.ts";

export const POSTING_COLUMNS = [
  "key",
  "source",
  "company",
  "title",
  "url",
  "location",
  "remote",
  "compensation",
  "posted_at",
  "description",
  "comp_min",
  "comp_max",
  "comp_period",
  "expired",
  "raw",
] as const;

const undeclared = POSTING_COLUMNS.filter((name) => !(name in TABLES.postings.shape));
if (undeclared.length) throw new Error(`postings has no column ${undeclared.join(", ")} — lib/schema.ts is the list`);

const text = z.preprocess((held) => (typeof held === "string" ? held.trim() : held), z.string());

const maybeText = z.preprocess(
  (held) => (held === undefined || held === "" ? null : typeof held === "string" ? held.trim() : held),
  z.string().nullable(),
);

const flag = z.preprocess(
  (held) => (held === null || held === undefined ? 0 : Number(Boolean(held))),
  z.union([z.literal(0), z.literal(1)]),
);

const pay = z.preprocess(
  (held) => (held === undefined || held === "" || held === null || Number(held) < 0 ? null : Number(held)),
  z.number().nullable(),
);

export const Posting = z.object({
  key: text.refine((held) => held.includes(":") && !held.endsWith(":"), {
    message: "key must be '<source>:<id>'",
  }),
  source: text,
  company: text.refine((held) => held.length > 0, {
    message: "company cannot be blank",
  }),
  title: text.refine((held) => held.length > 0, {
    message: "title cannot be blank",
  }),
  url: maybeText.default(null),
  location: z.preprocess((held) => (held === null || held === undefined ? "" : held), text).default(""),
  remote: flag.default(0),
  compensation: maybeText.default(null),
  posted_at: maybeText.default(null),
  description: maybeText.default(null),
  comp_min: pay.default(null),
  comp_max: pay.default(null),
  comp_period: z
    .preprocess((held) => {
      const said = String(held ?? "").toUpperCase();
      return options("postings", "comp_period").includes(said) ? said : null;
    }, z.string().nullable())
    .default(null),
  expired: flag.default(0),
  raw: maybeText.default(null),
});

export type Posting = z.infer<typeof Posting>;

export const posting = (input: unknown): Posting => Posting.parse(input);
