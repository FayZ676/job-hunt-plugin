# Manual boards

Companies worth watching that `scan.py` **cannot** reach, because they aren't on Greenhouse, Lever, or
Ashby. The list itself is user data and lives in **`career/manual-boards.md`**; this file is the
mechanics — why the list exists, how to check an entry, and how to keep it honest.

These are checked **by hand**, and only on the cadence each row names — not every morning. Most are
large employers whose boards move slowly, and a daily manual pass isn't worth the time.

## Why this file exists

The automated watchlist skews toward venture-backed product companies and AI labs, because that is who
uses the three supported ATSes. Most large regional employers — and nearly every bank, insurer, health
system, and manufacturer — are on Workday, iCIMS, Taleo, or SmartRecruiters instead. When
`career/search-profile.md` scores regulated, document-heavy, or local employers *up*, leaving them out
biases the whole search away from the roles that fit best.

## How to check one

There's no API, so this is a browser task. For each company due on the cadence:

1. Open the careers URL and filter for the role families `career/search-profile.md` targets.
2. Apply the same judgement as the automated path — read `career/search-profile.md`, score 0–10, and
   name the specific JD language that drove the score.
3. **Log it to `career/applications.jsonl` like any other candidate**, using a `manual:` key prefix so
   it's distinguishable and never re-surfaces:

   ```json
   {"key":"manual:acme:research-engineer-2026-08","company":"Acme","title":"Research Engineer","url":"https://…","location":"Denver, CO","posted_at":null,"first_seen":"2026-08-10","score":8,"reason":"…","status":"queued"}
   ```

   Build the key from `manual:<company-slug>:<role-slug>-<year>-<month>`. Without a ledger line, the
   same posting gets re-reviewed every time the cadence comes around.
4. Add anything shortlisted to the day's run entry under the normal Shortlist heading, marked
   `(manual board)` so it's clear it didn't come from `scan.py`.

## What Indeed changed, and what it didn't

The Indeed pass (`references/indeed.md`) reaches some of these employers — Workday shops that
`scan.py` cannot see often do syndicate to Indeed. That is real overlap, and it makes some cadences
redundant.

It does **not** retire the list, for three reasons:

1. **Indeed indexes what employers choose to syndicate.** A company that posts only to its own careers
   page is invisible there. Small local employers are exactly the ones least likely to syndicate.
2. **Indeed is a keyword search, not a watch.** The list says "check this company weekly" and means
   it. A role whose title misses every query in the matrix does not surface, and nothing reports that
   it was missed. A cadence check reads the whole board.
3. **A company can be present and still miss every query** in the matrix on a given day. A tier of
   employers whose only coverage is a search that can silently return nothing for them is not covered.

**So shrink the list on evidence, not on principle.** When Indeed surfaces one of these companies on
its own, two runs apart, that company's cadence can drop a tier — weekly to monthly, monthly to
quarterly — and the entry should say why and when. Delete an entry only when the company graduates to
`career/scan-config.json` by turning out to be on a supported ATS.

**Run the coverage audit before touching any cadence**: navigate to `indeed.com/cmp/<company>/jobs`, or
search the company by name, and record whether its postings appear at all. Because the pass runs by
navigation it is not rate-limited, so auditing the whole list is a few minutes of page loads. That
answer is what the tier changes should rest on.

## Maintenance

**Re-probe the list every few months.** Companies migrate ATSes, and a company that moves onto
Greenhouse, Lever, or Ashby should graduate out of `career/manual-boards.md` and into
`career/scan-config.json`, where it gets picked up automatically.

To re-probe, try each of these and look for a 200 with a non-empty job list:

```
https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=false
https://api.lever.co/v0/postings/<slug>?mode=json
https://api.ashbyhq.com/posting-api/job-board/<slug>
```
