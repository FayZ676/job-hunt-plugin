# The automated board scan

Everything about the API scan: running it, tuning what it returns, and adding companies to it.
The other two sources have their own files — `indeed.md` and `manual-boards.md`.

## Running it

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py"
```

Stdlib only, no install step. It hits every active board in parallel, applies the mechanical filters
(title regex, location, posting age), drops any `key` already in the ledger, and writes
`career/.state/scans/<date>.json`.

| Flag | Use |
| ---- | --- |
| `--company Anthropic` | scan one board, repeatable, for testing a newly added slug |
| `--include-seen` | ignore the ledger, for rebuilding a run entry |
| `--no-location-filter` | see what the location rule is costing |
| `--max-age-days 7` | tighten to the last week |
| `--force` | overwrite an existing candidates file |

`<date>.json` holds the full JD text that phases 3–4 read, so the script **refuses to
overwrite** a same-day file with a smaller result. A second plain run after the ledger is written
would otherwise wipe the day's descriptions. Rebuild a day with `--include-seen --force`.

Multi-location postings for one role merge into a single candidate, with the extra ids in
`duplicate_keys`. **Log every one of those ids to the ledger**, or the siblings return as new
tomorrow. This also means the ledger holds more lines than jobs — count unique roles, not lines.

**Read the failure list.** A failing board usually means the company moved ATS or the slug is wrong.
Fix `career/watchlist.toml` or set `"active": false`. Do not leave it failing every morning.

## Tuning the filters

The scan prints how many postings each filter dropped. Use those counts rather than guessing.

| Symptom | Fix |
| ------- | --- |
| Obvious junk in candidates | `title_exclude` in `career/watchlist.toml` |
| A real role got filtered out | `title_include`, or loosen `location_include` |
| Candidates fine, scores wrong | `career/search-profile.md` |
| Same company never has anything | `"active": false` |
| Too few candidates | check the location counter; it is usually location |

## Adding companies

Find the ATS slug from the careers page URL — `boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`,
`jobs.ashbyhq.com/<slug>` — add an entry to `companies`, then verify:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py" --company "<Name>" --include-seen
```

A slug that 404s is wrong, or the company is on an ATS this script does not support (Workday, Taleo,
iCIMS, SmartRecruiters) — see **The board APIs** below, and `references/manual-boards.md`.

## The board APIs

All three board APIs are public, unauthenticated, and return the full description plus an apply
URL in one call. No key, no scraping, no rate limit worth worrying about.

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
