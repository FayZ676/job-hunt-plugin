# Fetching

Getting postings into `postings`, the raw layer. **Fetching judges nothing**: no filtering, no
scoring, no `prospects` row. Everything a source returned is stored as it arrived, normalized into
shared columns, and `job-scan ingest` rules on it afterwards.

Two mechanisms, four sources, one destination. **`job-scan sources` prints the registry** — each
source's kind, rank, endpoint and the quirk that bites when it goes quiet:

| Mechanism | Sources | How |
| --------- | ------- | --- |
| **Board API** | Greenhouse, Lever, Ashby | Public JSON, one request per board, fetched in parallel |
| **Paid search** | Indeed | The Apify actor `misceres/indeed-scraper`, billed per listing |
| **By hand** | Workday, iCIMS, Taleo, SmartRecruiters, BambooHR | No public board; checked on a cadence |

Adding a source is one entry in `sources.REGISTRY` — a function returning `Posting` objects, a
`kind`, a `rank`, an endpoint and a quirk; nothing downstream changes, because no later step knows
which source a row came from. The registry lives in `lib/sources.ts`, and `cli/scan.ts` is what calls it.

## Contents

- Boards — running the fetch, adding a company
- Indeed search — what it is for, and how to aim it
- Manual boards — the ATSes with no public JSON, and their cadence
- Traps — an empty search, a board that fails every morning

## Boards

```bash
job-scan boards
```

Reads the company list out of the database, hits every active Greenhouse, Lever and Ashby board in
parallel, and upserts what came back. Re-running is free: a stored posting has its `last_fetched`
bumped and its disposition left alone.

`--company Anthropic` fetches one board, repeatable, for testing a newly added slug; `--workers N`
sets parallelism. **Read the failure list.** A failing board usually means the company moved ATS or
the slug is wrong. Fix the slug, or `UPDATE companies SET active=0 WHERE slug='…'`. Do not leave it
failing every morning.

### Adding a company

The slug is the company's careers-page path — `boards.greenhouse.io/anthropic`,
`jobs.lever.co/shieldai`, `jobs.ashbyhq.com/ramp`. Many companies host the board on their own domain
with the ATS behind an iframe; view source, or check where the "Apply" button points.

```bash
$Q "INSERT INTO companies(slug,ats,name,source) VALUES('anthropic','greenhouse','Anthropic','manual')"
job-scan boards --company Anthropic
job-scan ingest
```

A slug that 404s is wrong, or the company is on an ATS with no public board. Those go in as manual
boards instead.

## Indeed search

Indeed is a **discovery layer**, not a new place to apply: the boards watch companies already chosen,
and this answers what they cannot — *who is hiring that isn't on the list at all.* Once a row is
stored, an Indeed posting is a posting like any other.

```bash
job-scan indeed                                     # your title_preferred rows, Remote, 50 each
job-scan indeed --query "AI engineer" --max 25
job-scan indeed --query "AI engineer" --query "ML engineer" --location "Austin, TX"
```

With no `--query`, the queries are your `title_preferred` rows, strongest first — the same
vocabulary the scorer uses, so discovery and scoring cannot drift apart.

Descriptions come back with the search, so there is nothing to fetch afterwards. `--max` is a
per-query budget of billed listings, not a page size — the default is a sane spend, so raise it
deliberately or not at all.

## Manual boards

**Workday, Taleo, iCIMS, SmartRecruiters and BambooHR have no public JSON board**, so nothing can
fetch them. They are rows in the same table with `ats='manual'` and a cadence:

```bash
$Q "INSERT INTO companies(slug,ats,name,careers_url,cadence)
    VALUES('galois','manual','Galois','https://galois.com/careers/','Weekly')"
$Q "SELECT * FROM manual_boards"                                  -- what is due, by cadence
$Q "UPDATE companies SET last_checked=date('now') WHERE slug='galois'"
```

Check what is due, then `INSERT` finds straight into `postings` with `disposition='kept'`, keyed
`manual:<slug>:<role>-<year>-<month>` — a hand check has already done the filtering ingest would do,
and `kept` is what makes the row a prospect.
**A company that migrates onto a supported ATS should change `ats`** and start being fetched
automatically.

This list matters because the watchlist skews toward venture-backed product companies — that is who
uses the three supported ATSes. Banks, insurers, health systems, manufacturers and large regional
employers are on Workday or iCIMS, so leaving them out biases the whole search. Indeed **widens**
coverage without guaranteeing it for any employer; where one shows real coverage of a manual board,
cut that board's cadence.

**LinkedIn stays out of scope**: heavy with reposted and ghost listings, and no stable per-posting id
to dedupe against.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A query returns nothing | Too narrow a `--query`/`--location` pair | Widen one of them; an empty search costs nothing |
| A board fails every morning | Company moved ATS, or the slug is wrong | Fix the slug or deactivate the company |
