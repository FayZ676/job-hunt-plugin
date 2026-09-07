# Searching

Finding the openings. **You do the searching, in the browser.** Indeed is navigated like a person
would, the result cards are read out of the page's own data, saved to a file, and `job-search
harvest` reads that file into `postings`. Then every stored row is ruled and the survivors are
promoted to prospects.

Nothing here costs money or needs a key, and there is no list of employers to maintain: reach is
whatever you type into the search box.

## Navigate, never fetch

Getting this wrong is what makes Indeed look unusable.

**`browser_navigate` to each search URL like a person would.** Indeed serves those without
complaint; what it throttles is `fetch()`/XHR against the same URLs — same session, same cookies,
but no navigation fingerprint and no referer chain. Measured in one session: `urllib` blocked at
request 2, in-page `fetch()` returned 429 on 14 of 16, `page.goto()` returned 200 on all 40 *while
`fetch` from the same page was still 403.*

Keep the pacing human anyway — a little jitter, a scroll per page. That is politeness, not a
workaround.

## What to search for

**Nothing about what to search for is baked into this skill.** The terms come off `job-score
instructions` and the profile — read both, then build the URLs. If something belongs in the search
and is in neither, that is the gap: decide whether it is a profile fact or a line the user should
add to their instructions, and ask.

| Part of the query | Comes from |
| ----------------- | ---------- |
| `q` | the titles named in `instructions` — the same words the scorer reads |
| `l` | `identity.location`, and what the instructions say about where they will work |
| `sc=0kf:attr(DSQF7)` | `identity.remote_preference`, when remote-only |
| `fromage` | the user — ask how far back before the first run |
| `--not-title`, `--not-company` | the titles and employers the instructions rule out |

**The terms match the title, and nothing else.** Say them the way a title says them, short and
literal, and run several narrow queries rather than one broad one.

**Do not narrow location past what the user actually said.** A posting open in both London and New
York is one a US-based user still wants to see. The description read at scoring is the backstop.

## 1. Search

For each query, navigate to the search URL, then read the cards out of the page's own data — no HTML
parsing, because the payload is already there:

```js
window.mosaic.providerData['mosaic-provider-jobcards']
      .metaData.mosaicProviderJobCardsModel.results
```

**`jobkey` is a stable per-posting id**, which is what makes Indeed dedupable at all. Keys are
`indeed:<jobkey>`.

Navigation wipes page variables, so **accumulate across queries in `localStorage`** — same origin, so
it survives every navigate:

```js
const store = JSON.parse(localStorage.getItem('__jobHarvest') || '{"results":[]}');
store.results.push({query, location, rows});
localStorage.setItem('__jobHarvest', JSON.stringify(store));
```

**Do not paginate.** `&start=10` is the one request shape that still draws a block, and page 2 of a
narrow query is worth less than page 1 of a different one. More queries, one page each.

## 2. Onto disk without spending context

A harvest runs ~90KB. **Do not read it through the model to write it out.** Save it with a blob
download instead, so nothing large ever passes through the conversation:

```js
const blob = new Blob([localStorage.getItem('__jobHarvest')], {type:'application/json'});
const a = document.createElement('a');
a.href = URL.createObjectURL(blob); a.download = 'indeed-raw.json';
document.body.appendChild(a); a.click();
```

```bash
job-search harvest --file indeed-raw.json --not-title intern
```

Same trick for the descriptions file.

## 3. Descriptions, for kept rows only

The search cards carry a truncated snippet that is **not good enough to score on**, and `job-score
set` refuses a posting without a description. So descriptions are fetched after ruling, for
survivors only: navigate to `/viewjob?jk=<jobkey>` for each, read `#jobDescriptionText`, accumulate
in `localStorage` as `[{jobkey, description}]`, and save the same way.

```bash
job-search descriptions --file indeed-descs.json
```

**Cap each at ~4,000 characters** — full ones run 9,000–14,500, and the cap is what keeps two dozen
of them affordable.

## Every row keeps its verdict

`DISPOSITIONS` in `lib/search.ts` names the verdicts, and `job-search dispositions` prints them in
the order the chain rules them — read it there rather than from a copy.

**What the chain rules on is deliberately small: expiry, the profile's compensation floor, age, and
what has already been seen.** There is no pattern table and no stored filter vocabulary. Anything
that takes judgment about whether a role fits — the title, the seniority, the field, whether the
employer is a reposter — is the scorer's call, made against the instructions with the full
description in hand. Do not reintroduce a local pattern rule to pre-empt it; say it in the
instructions, where it is read once and applied everywhere.

**Only a stated yearly band is judged against the floor**, and Indeed states one on a minority of
cards. A blank `compensation` is not a low one.

## Dedupe

Two checks:

1. **The key**, against every row already kept or already pointing at one through `canonical_key`.
2. **Normalized company + title**, with names normalized past `Inc`/`LLC`/`Technologies`. One role
   posted under several locations arrives as several rows; they collapse onto one, preferring a row
   already kept and then a remote one. The siblings are ruled `duplicate` and point at the survivor
   through `canonical_key`, so they never resurface as new. Every location the role was listed under
   stays queryable: `SELECT location FROM postings WHERE canonical_key='<key>'`.

The same role reached by two different queries collapses on the key alone, so overlapping searches
cost nothing but time.

## Tuning

A run prints its drop counts, and because the verdicts are stored they stay queryable:

```bash
$Q "SELECT disposition, COUNT(*) n FROM postings WHERE ingested_on=date('now') GROUP BY disposition"
$Q "SELECT company,title,location FROM postings WHERE disposition='stale' LIMIT 20"
```

The second query is the one that matters: **read what a rule actually dropped** rather than guessing
from a count. Re-ruling the same postings reads nothing new:

```bash
job-search rule --redo
```

| Symptom | Fix |
| ------- | --- |
| Obvious junk in prospects | name it in `instructions`, then pass it as `--not-title` next harvest |
| A real role never arrived | the terms miss how the title words it — try the employer's own name as a query |
| Prospects fine, scores wrong | `instructions` |
| Too few prospects | more queries, each narrow, rather than a wider `fromage` |

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `harvest holds no job cards` | Indeed changed the payload shape, or the wrong object was saved | Snapshot the page and find where the cards now live; the path is one line in `lib/core/indeed.ts` |
| A search returns almost nothing | The terms do not match how titles are worded | Widen the terms, not the window |
| A 403 or a captcha | Something did `fetch()` instead of navigating | Navigate; see above |
| A captcha mid-harvest | Indeed is asking for a person, and only a person answers it | Hand the open window over; a harvest that stopped early reads as a quiet market, so check the card count against the queries you ran before ruling on it |
| Sponsored junk from staffing firms | Indeed sells placement | `--not-company`, and name them in `instructions` |
| A prospect has no description at scoring | The `/viewjob` pass has not run for it | `job-search descriptions` lists exactly which rows are missing one |
