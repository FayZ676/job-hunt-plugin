# Boards and the fetch/ingest split

Fetching postings, ruling on them, tuning what survives, adding companies, and working the boards no
API reaches. Indeed rides the same path and only differs in how its bytes arrive — `indeed.md`.

## Fetching

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/fetch.py" boards
```

Needs `pydantic` (`python3 -m pip install pydantic`); nothing else. Reads the company list out of the
database, hits every active Greenhouse, Lever and Ashby board in parallel, and writes what came back
into `postings` — **normalized but unjudged**. No filtering happens here and no `prospects` row is
written.

| Flag | Use |
| ---- | --- |
| `--company Anthropic` | fetch one board, repeatable, for testing a newly added slug |
| `--workers N` | parallelism, default 8 |

**Read the failure list.** A failing board usually means the company moved ATS or the slug is wrong.
Fix the slug, or `UPDATE companies SET active=0 WHERE slug='…'`. Do not leave it failing every
morning.

## Ingesting

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/ingest.py"
```

Rules on every pending posting and promotes the survivors into `prospects` as `new`. Multi-location
postings for one role merge into a single prospect, with the siblings stored as aliases so they never
resurface. Every row it touches gets a `disposition` — `kept`, or the filter that dropped it.

| Flag | Use |
| ---- | --- |
| `--redo` | rule again on everything, including rows already decided, without re-fetching |
| `--source indeed` | limit to one source |
| `--include-seen` | ignore what is already in `prospects` |
| `--keep-covered` | keep rows whose company a better-ranked source already covers |
| `--no-location-filter` | see what the location rule is costing |
| `--max-age-days 7` | tighten to the last week |
| `--comp-floor N` | override the stored floor for one run |

**Source precedence.** Every source carries a rank: an employer's own board is authoritative (0), an
aggregator is discovery (1). When a better-ranked source turns up a role an aggregator already found,
ingest **upgrades** the existing prospect in place — swapping in the real description and apply URL,
keeping its key and history — rather than creating a second row. That is the compounding win: a
company gets discovered once and fetched properly forever after.

## Tuning the filters

Ingest prints its drop counts, and because the verdicts are stored they stay queryable afterwards:

```bash
$Q "SELECT disposition, COUNT(*) n FROM postings WHERE ingested_on=date('now') GROUP BY disposition"
$Q "SELECT company,title,location FROM postings WHERE disposition='location' LIMIT 20"
```

**Test a filter change before keeping it.** `ingest.py --redo` re-rules the stored postings with no
network at all, so the cost of a wrong filter is one command rather than a re-scan.

```bash
$Q "SELECT kind, pattern, note FROM filters"
$Q "INSERT INTO filters(kind,pattern,note) VALUES('title_exclude','(?i)contract','no contract roles')"
$Q "DELETE FROM filters WHERE kind='title_exclude' AND pattern='(?i)contract'"
```

| Symptom | Fix |
| ------- | --- |
| Obvious junk in candidates | add to `title_exclude`, then `ingest.py --redo` |
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
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/fetch.py" boards --company Anthropic
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/ingest.py"
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

`sources.py` owns these; the notes are here for debugging a board that goes quiet.

| ATS | Endpoint | Notes |
| --- | -------- | ----- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true` | `content` is HTML-escaped HTML — needs unescaping twice. Without `?content=true` there are no descriptions to score on |
| Lever | `api.lever.co/v0/postings/<slug>?mode=json` | Returns a **bare array**. `createdAt` is epoch **ms**. A live board with no postings returns `[]` at 200; a wrong slug 404s. Adoption is thinning — re-verify slugs that go quiet |
| Ashby | `api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true` | Best payload: `descriptionPlain` needs no HTML handling, `isRemote` is a real boolean, and compensation bands come back. Skip `isListed: false` — unlisted or closed |

All three are public and unauthenticated, and return the full description plus an apply URL in one
call. No key, no scraping, no rate limit worth worrying about.
