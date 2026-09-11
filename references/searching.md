# Searching

Finding the openings. **`job-search run` does the searching**, in the browser `job-browser` leaves
running: it navigates each query like a person would, reads the result cards out of the page's own
data, rules on them, and then fetches the full description of every survivor.

Nothing here costs money or needs a key, and there is no list of employers to maintain: reach is
whatever you type into the search box.

## What to search for

**Nothing about what to search for is baked into this skill.** The terms come off `job-score
instructions` and the profile — read both, then build the URLs. If something belongs in the search
and is in neither, that is the gap: decide whether it is a profile fact or a line the user should
add to their instructions, and ask.

| Part of the query | Comes from |
| ----------------- | ---------- |
| `q=title:"…"` | the titles named in `instructions` — the same words the scorer reads |
| `l` | `identity.location`, and what the instructions say about where they will work; `l=Remote` when `identity.remote_preference` is remote-only |
| `fromage` | the user — ask how far back before the first run |
| `--not-title`, `--not-company` | the titles and employers the instructions rule out |

**Scope `q` with `title:"…"`, and take remote through `l=Remote`.** A bare `q=` term matches loosely
and returns off-target results; the `sc=0kf:attr(DSQF7)` remote filter documented in earlier
versions of this file made the navigation time out — do not reintroduce it.

**The terms match the title, and nothing else.** Say them the way a title says them, short and
literal, and run several narrow queries rather than one broad one.

**Do not narrow location past what the user actually said.** A posting open in both London and New
York is one a US-based user still wants to see. The description read at scoring is the backstop.

**Do not paginate.** `&start=10` is the one request shape that still draws a block, and page 2 of a
narrow query is worth less than page 1 of a different one. More queries, one page each.

## Run it

Write the URLs one per line, then hand the file over:

```bash
job-search run --queries queries.txt --not-title intern
```

**Wait for it, and go on to scoring in the same breath** — that is the point of one command doing
the whole pass. It prints a line per page, so watch it rather than guessing at it.

**A run is roughly five seconds a posting, so give the call a timeout that fits** — a hundred
postings is around eight minutes. Past what one call can hold, pass `--limit` and run it again;
it says how many are left each time.

Descriptions are written as each one lands, so a run cut short — a timeout, a captcha, a closed
laptop — keeps everything it fetched. `job-search run` with no queries fetches only what is still
missing, which is how any interrupted run is finished.

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
   `jobkey` is stable per posting, which is what makes Indeed dedupable at all; keys are
   `indeed:<jobkey>`.
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
| Obvious junk in prospects | name it in `instructions`, then pass it as `--not-title` next run |
| A real role never arrived | the terms miss how the title words it — try the employer's own name as a query |
| Prospects fine, scores wrong | `instructions` |
| Too few prospects | more queries, each narrow, rather than a wider `fromage` |

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `harvest holds no job cards` | Indeed changed the payload shape | Snapshot the page and find where the cards now live; the path is one line in `lib/core/indeed.ts` |
| A search returns almost nothing | The terms do not match how titles are worded | Widen the terms, not the window |
| A run stops after five empty pages | Indeed is asking for a person | A harvest that stopped early reads as a quiet market, so check the card count against the queries you ran |
| A 403 where a navigation worked | Something did `fetch()`/XHR instead of navigating; Indeed throttles those against the same URLs even in the same session | Navigate — which is all `job-search run` does |
| Sponsored junk from staffing firms | Indeed sells placement | `--not-company`, and name them in `instructions` |
| Driving the browser by hand after a captcha | — | Save the cards yourself and use `job-search harvest --file` / `descriptions --file`; both take what you read out of the page |
