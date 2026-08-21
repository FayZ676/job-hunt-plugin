# ATS endpoints

All three are public, unauthenticated, free, and return the full job description plus an apply URL in
one call. No scraping, no API key, no rate limit worth worrying about at 60 boards a day.

Verified working 2026-08-06.

## Greenhouse

```
https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
```

`{"jobs": [...]}`. Fields used: `id`, `title`, `absolute_url`, `location.name`, `first_published`,
`updated_at`, `content`.

**`content` is HTML-escaped HTML** — it arrives as `&lt;div&gt;`, so it needs `html.unescape` before
tag stripping and again afterwards for inner entities. `scan.py` does both.

Without `?content=true` the descriptions are omitted and the payload is much smaller — but scoring
needs the description, so always request it.

## Lever

```
https://api.lever.co/v0/postings/<slug>?mode=json
```

Returns a **bare JSON array**, not an object. Fields used: `id`, `text` (the title), `hostedUrl`,
`applyUrl`, `createdAt` (epoch **milliseconds**), `categories.location`, `categories.allLocations`,
`workplaceType`, `salaryRange`, `descriptionPlain`.

A live board with zero postings returns `[]` with HTTP 200; a wrong slug returns 404. Lever adoption
has thinned out — several companies that used it have migrated to Greenhouse or Ashby, so re-verify
slugs that suddenly go quiet.

## Ashby

```
https://api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true
```

`{"jobs": [...]}`. Fields used: `id`, `title`, `location`, `secondaryLocations`, `isRemote`,
`isListed`, `jobUrl`, `applyUrl`, `publishedAt` (ISO 8601), `compensation`, `descriptionPlain`.

Best payload of the three — `descriptionPlain` needs no HTML handling, `isRemote` is an explicit
boolean rather than something to infer from a location string, and `includeCompensation=true` returns
real salary bands for the many companies now legally required to post them.

Skip anything with `isListed: false` — those are unlisted or closed.

## Not supported

**Workday, Taleo, iCIMS, SmartRecruiters, and BambooHR** have no equivalent public JSON board. Workday
in particular is a tenant-scoped POST API that changes shape per employer, and it's also the worst
application experience to automate. Companies on these are best tracked manually or via a weekly
web-search sweep rather than added here.

**LinkedIn** stays out of scope: heavy with reposted and ghost listings, and no stable per-posting id
to dedupe against.

**Indeed is in scope as of 2026-08-21**, but not here — it has no board API, so it cannot join the
table above. It is a browser pass with its own reference, `references/indeed.md`. The old objection
that it gives no stable id turned out to be wrong: every posting carries a `jobkey` that dedupes
cleanly. The reposted-and-ghost-listings objection was right, and `indeed_filter.py` exists to answer
it — about 60% of what a query returns gets dropped before anything is read.

## Finding a slug

It's the company's careers-page path:

- `boards.greenhouse.io/anthropic` or `job-boards.greenhouse.io/anthropic` → `anthropic`
- `jobs.lever.co/shieldai` → `shieldai`
- `jobs.ashbyhq.com/ramp` → `ramp`

Many companies host the board on their own domain with the ATS behind an iframe — view source, or
check where the "Apply" button points.
