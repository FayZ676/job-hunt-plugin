# The automated board scan

Running the API scan, tuning what it returns, adding companies, and working the boards no API
reaches. Indeed has its own file, `indeed.md`.

## Running it

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py"
```

Stdlib only, no install step. Reads the company list and filters out of the database, hits every
active Greenhouse, Lever and Ashby board in parallel, applies the mechanical filters, skips anything
already known, and inserts the rest into `prospects`. Multi-location postings for one role merge into
a single prospect, with the sibling ids stored as aliases so they never resurface as new.

| Flag | Use |
| ---- | --- |
| `--company Anthropic` | scan one board, repeatable, for testing a newly added slug |
| `--include-seen` | re-insert prospects already in the database |
| `--no-location-filter` | see what the location rule is costing |
| `--max-age-days 7` | tighten to the last week |
| `--workers N` | parallelism, default 8 |

**Read the failure list.** A failing board usually means the company moved ATS or the slug is wrong.
Fix the slug, or `UPDATE companies SET active=0 WHERE slug='…'`. Do not leave it failing every
morning.

## Tuning the filters

The scan prints how many postings each filter dropped. Use those counts rather than guessing.

```bash
$Q "SELECT kind, pattern, note FROM filters"
$Q "INSERT INTO filters(kind,pattern,note) VALUES('title_exclude','(?i)contract','no contract roles')"
$Q "DELETE FROM filters WHERE kind='title_exclude' AND pattern='(?i)contract'"
```

| Symptom | Fix |
| ------- | --- |
| Obvious junk in candidates | add to `title_exclude` |
| A real role got filtered out | add to `title_include`, or loosen `location_include` |
| Candidates fine, scores wrong | `search_criteria` and `search_notes`, not filters |
| Same company never has anything | `UPDATE companies SET active=0 WHERE slug='…'` |
| Too few candidates | check the location counter; it is usually location |

## Adding companies

The slug is the company's careers-page path — `boards.greenhouse.io/anthropic`,
`jobs.lever.co/shieldai`, `jobs.ashbyhq.com/ramp`. Many companies host the board on their own domain
with the ATS behind an iframe; view source, or check where the "Apply" button points.

```bash
$Q "INSERT INTO companies(slug,ats,name,source) VALUES('anthropic','greenhouse','Anthropic','manual')"
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py" --company Anthropic --include-seen
```

A slug that 404s is wrong, or the company is on an ATS this script cannot read. Those go in as
manual boards instead.

## Manual boards

**Workday, Taleo, iCIMS, SmartRecruiters and BambooHR have no public JSON board**, so they cannot be
scanned. They are rows in the same table with `ats='manual'` and a cadence:

```bash
$Q "INSERT INTO companies(slug,ats,name,careers_url,cadence,why)
    VALUES('galois','manual','Galois','https://galois.com/careers/','Weekly','formal methods; local')"
$Q "SELECT * FROM manual_boards"                                  -- what is due, by cadence
$Q "UPDATE companies SET last_checked=date('now') WHERE slug='galois'"
```

Check what is due, score finds like any other prospect, and record them with an `INSERT` into
`prospects` keyed `manual:<slug>:<role>-<year>-<month>`. **A company that migrates onto a supported
ATS should change `ats`** and start being scanned automatically.

This list matters because the automated watchlist skews toward venture-backed product companies —
that is who uses the three supported ATSes. Large regional employers, banks, insurers, health systems
and manufacturers are on Workday or iCIMS, so leaving them out biases the whole search. Indeed
**widens** coverage but does not guarantee it for any particular employer; where an Indeed pass shows
real coverage of a manual board, cut that board's cadence.

**LinkedIn stays out of scope**: heavy with reposted and ghost listings, and no stable per-posting id
to dedupe against.

## The board APIs

`scan.py` owns these; the notes are here for debugging a board that goes quiet.

| ATS | Endpoint | Notes |
| --- | -------- | ----- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true` | `content` is HTML-escaped HTML — needs unescaping twice. Without `?content=true` there are no descriptions to score on |
| Lever | `api.lever.co/v0/postings/<slug>?mode=json` | Returns a **bare array**. `createdAt` is epoch **ms**. A live board with no postings returns `[]` at 200; a wrong slug 404s. Adoption is thinning — re-verify slugs that go quiet |
| Ashby | `api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true` | Best payload: `descriptionPlain` needs no HTML handling, `isRemote` is a real boolean, and compensation bands come back. Skip `isListed: false` — unlisted or closed |

All three are public and unauthenticated, and return the full description plus an apply URL in one
call. No key, no scraping, no rate limit worth worrying about.
