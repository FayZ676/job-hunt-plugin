# Fetching

Getting postings into `postings`, the raw layer. **Fetching judges nothing**: no filtering, no
scoring, no `prospects` row. Everything a source returned is stored as it arrived, normalized into
shared columns, and `ingest.py` rules on it afterwards — `references/ingesting.md`.

That separation is what makes a filter change cheap. The postings are already on disk, so trying a
different rule costs one `ingest.py --redo` instead of a second visit to every board.

Two mechanisms, four sources, one destination:

| Mechanism | Sources | How |
| --------- | ------- | --- |
| **Board API** | Greenhouse, Lever, Ashby | Public JSON, one request per board, fetched in parallel |
| **Browser harvest** | Indeed | A browser collects it, because Indeed throttles `fetch()` but not navigation |
| **By hand** | Workday, iCIMS, Taleo, SmartRecruiters, BambooHR | No public board; checked on a cadence |

Adding a source is one entry in `sources.REGISTRY` — a function returning `Posting` objects, a
`kind`, and a `rank`. Nothing downstream changes, because no step after this one knows which source
a row came from.

`fetch.py` needs `pydantic` (`python3 -m pip install pydantic`); nothing else does.

## Boards

```bash
python3 "$HOME/.claude/skills/job/scripts/fetch.py" boards
```

Reads the company list out of the database, hits every active Greenhouse, Lever and Ashby board in
parallel, and upserts what came back. Re-running is free — a posting already stored just has its
`last_fetched` bumped, and its disposition is left alone.

| Flag | Use |
| ---- | --- |
| `--company Anthropic` | fetch one board, repeatable, for testing a newly added slug |
| `--workers N` | parallelism, default 8 |

**Read the failure list.** A failing board usually means the company moved ATS or the slug is wrong.
Fix the slug, or `UPDATE companies SET active=0 WHERE slug='…'`. Do not leave it failing every
morning.

### Adding a company

The slug is the company's careers-page path — `boards.greenhouse.io/anthropic`,
`jobs.lever.co/shieldai`, `jobs.ashbyhq.com/ramp`. Many companies host the board on their own domain
with the ATS behind an iframe; view source, or check where the "Apply" button points.

```bash
$Q "INSERT INTO companies(slug,ats,name,source) VALUES('anthropic','greenhouse','Anthropic','manual')"
python3 "$HOME/.claude/skills/job/scripts/fetch.py" boards --company Anthropic
python3 "$HOME/.claude/skills/job/scripts/ingest.py"
```

A slug that 404s is wrong, or the company is on an ATS with no public board. Those go in as manual
boards instead.

### The board APIs

`sources.py` owns these; the notes are here for debugging a board that goes quiet.

| ATS | Endpoint | Notes |
| --- | -------- | ----- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true` | `content` is HTML-escaped HTML — needs unescaping twice. Without `?content=true` there are no descriptions to score on |
| Lever | `api.lever.co/v0/postings/<slug>?mode=json` | Returns a **bare array**. `createdAt` is epoch **ms**. A posting splits across `descriptionPlain`, `lists` and `additional` — requirements usually live in `lists`. A live board with no postings returns `[]` at 200; a wrong slug 404s |
| Ashby | `api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true` | Best payload: `descriptionPlain` needs no HTML handling, `isRemote` is a real boolean, and compensation bands come back. `isListed: false` is normalized to `expired` and dropped at ingest |

All three are public and unauthenticated, and return the full description plus an apply URL in one
call. No key, no scraping, no rate limit worth worrying about.

## Browser harvest

Indeed is a **discovery layer**, not a new place to apply: the boards watch companies already chosen,
and this answers what they cannot — *who is hiring that isn't on the list at all.* Once the harvest
is read, an Indeed row is a posting like any other.

### Navigate, never fetch

This is the whole trick, and getting it wrong is what makes Indeed look unusable.

**Navigate to each search URL like a person would.** Indeed serves those requests without complaint.
What it throttles is `fetch()`/XHR against the same URLs — same session, same cookies, but no
navigation fingerprint, no referer chain, no page assets. Measured in one session, 2026-08-21:
`urllib` blocked at request 2; in-page `fetch()` at 1.8s intervals returned 14 × 429 out of 16; and
`page.goto()` returned 200 on all 40 navigations *while `fetch` from the same page was still 403*.

There is no query budget to ration and no rotation scheme to maintain. Keep the pacing human anyway —
a couple of seconds of jitter and a scroll per page — but that is politeness, not a workaround.

### 1. Search

For each query, `page.goto` the search URL, then read the results out of the page's own data — no
HTML parsing, because the payload is already there:

```js
window.mosaic.providerData['mosaic-provider-jobcards']
      .metaData.mosaicProviderJobCardsModel.results
```

Keep per card: `jobkey`, `company`, `title`, `formattedLocation`, `pubDate` (epoch ms), `sponsored`,
`expired`, `indeedApplyEnabled`, `remoteWorkModel.type`, `extractedSalary`. **`jobkey` is a stable
per-posting id** — that is what makes Indeed dedupable at all. Keys are `indeed:<jobkey>`.

Navigation wipes page variables, so **accumulate across queries in `localStorage`** — same origin, so
it survives every `goto`:

```js
const store = JSON.parse(localStorage.getItem('__jobHarvest') || '{"results":[]}');
store.results.push({query, location, rows});
localStorage.setItem('__jobHarvest', JSON.stringify(store));
```

**Do not paginate.** `&start=10` is the one request shape that still draws a block, and page 2 of a
narrow query is worth less than page 1 of a different one. More queries, one page each.

### 2. Onto disk without spending context

The harvest is ~90KB. Do not read it through the model to write it out. The Playwright process has no
filesystem access, but a blob download does:

```js
const [download] = await Promise.all([
  page.waitForEvent('download', {timeout: 20000}),
  page.evaluate(() => {
    const blob = new Blob([localStorage.getItem('__jobHarvest')], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'indeed-raw.json';
    document.body.appendChild(a); a.click();
  })
]);
await download.saveAs('…/indeed-raw.json');
```

Same trick for the descriptions file. Nothing large ever passes through the conversation.

### 3. Load it into the raw layer

```bash
python3 "$HOME/.claude/skills/job/scripts/fetch.py" harvest --source indeed --file <harvest.json>
```

Parses the harvest into `postings`, including the facts only this source states — whether a card is
`sponsored` or `expired`, and the salary band it extracted. They go into the same columns every
source uses, which is why they are filtered by the same rules and not by anything Indeed-specific.

Then run `ingest.py` as for any other source.

### 4. Descriptions, for kept rows only

The search cards carry a truncated `snippet` that is **not good enough to score on**, so descriptions
are fetched after ingest, for survivors only. Navigate to `/viewjob?jk=<jobkey>` for each, read
`#jobDescriptionText` plus `#salaryInfoAndJobType`, accumulate in `localStorage`, and save the same
way. **Cap each at ~4,000 characters** — full ones run 9,000–14,500, and the cap is what keeps two
dozen of them affordable.

```bash
python3 "$HOME/.claude/skills/job/scripts/fetch.py" descriptions --file <descs.json>
```

Attaches them to the rows ingest kept and warns about any prospect still without one.

## Manual boards

**Workday, Taleo, iCIMS, SmartRecruiters and BambooHR have no public JSON board**, so nothing can
fetch them. They are rows in the same table with `ats='manual'` and a cadence:

```bash
$Q "INSERT INTO companies(slug,ats,name,careers_url,cadence,why)
    VALUES('galois','manual','Galois','https://galois.com/careers/','Weekly','formal methods; local')"
$Q "SELECT * FROM manual_boards"                                  -- what is due, by cadence
$Q "UPDATE companies SET last_checked=date('now') WHERE slug='galois'"
```

Check what is due, then `INSERT` finds straight into `prospects` keyed
`manual:<slug>:<role>-<year>-<month>` — a hand check has already done the filtering ingest would do.
**A company that migrates onto a supported ATS should change `ats`** and start being fetched
automatically.

This list matters because the watchlist skews toward venture-backed product companies — that is who
uses the three supported ATSes. Large regional employers, banks, insurers, health systems and
manufacturers are on Workday or iCIMS, so leaving them out biases the whole search. A harvest
**widens** coverage but does not guarantee it for any particular employer; where one shows real
coverage of a manual board, cut that board's cadence.

**LinkedIn stays out of scope**: heavy with reposted and ghost listings, and no stable per-posting id
to dedupe against.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| 429s or 403s from a harvest | Using `fetch()` instead of navigating | Navigate. This is the one mistake that makes Indeed look rate-limited |
| Blocked even while navigating | `&start=` pagination, or a prior `fetch` run poisoned the session | Drop pagination; a poisoned session clears on its own |
| `window.mosaic` undefined | Read ran before the page settled, or the response was a block page | Check the navigation status, then wait and re-read |
| A board fails every morning | Company moved ATS, or the slug is wrong | Fix the slug or deactivate the company |
| Comp band looks absurd | `extractedSalary` is inferred, not stated | Trust `#salaryInfoAndJobType` on the JD page over the card |
