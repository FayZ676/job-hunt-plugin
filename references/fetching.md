# Fetching

Getting postings into `postings`, the raw layer. **Fetching judges nothing**: no filtering, no
scoring, no prospect. Everything the search returned is stored as it arrived, normalized into shared
columns, and `job-scan ingest` rules on it afterwards.

One command, `job-scan search`: who is hiring for the work, anywhere. It calls one paid Apify
actor, `fantastic-jobs/career-site-job-listing-api`, which indexes 175k company career sites across 54 ATSes — Greenhouse, Lever and Ashby, and also Workday, iCIMS,
SuccessFactors, Oracle Cloud, BambooHR, Rippling, SmartRecruiters, Eightfold. There is no ATS left
to check by hand, and no aggregator in the path: every row's `url` is the employer's own posting,
with the description already attached.

## The bill is the filter

**Billing is per job returned, so a filter the API can apply is money, and a filter only `ingest`
applies is money already spent.** Every filter that can be pushed into the request already is:

| Local filter | Rides along as | Note |
| ------------ | -------------- | ---- |
| `title` criteria | `titleSearch` | |
| `title_exclude`, `title_noise` | `titleExclusionSearch` | the regex alternations are flattened into literal terms; a pattern with no closing `\b` becomes a `:*` prefix match |
| `agency_blocklist` | `organizationExclusionSearch` | alongside the API's own `removeAgency` |
| `max_age_days` | `--since` | |

A pattern too complex to flatten safely — a character class, a quantifier, a bare alternation — is
left to `ingest` rather than guessed at.

**`location_exclude` is deliberately NOT pushed.** A posting open in both London and New York is one
the local rule keeps on its US anchor, and an API-side exclusion would drop it before anyone saw it.
Paying for a few foreign rows is cheaper than never seeing a US job.

The chain still rules on everything that comes back — the request narrows, `ingest` decides. The one
thing the request cannot know is `title_include`, so **`search` warns when a searched title could
not survive it**: those jobs are bought and then dropped. Fix the disagreement in one direction or
the other; do not pay for it twice a week.

```bash
job-scan search                                  # the title criteria, US, last 7 days
job-scan search --remote --since 24h --max 100   # a daily pass
job-scan search --title "AI Engineer" --location "Oregon, United States"
```

With no `--title`, the titles are the `title` criteria rows — the same vocabulary the scorer uses,
so discovery and scoring cannot drift apart. A parenthetical is stripped and anything over five
words is dropped, because those rows are written for the scorer to read, not for a search box.

`--since` is `1h`, `24h`, `7d` or `6m`; `6m` is the backfill worth running once, on the first scan,
and rarely again.

**A misspelled or abbreviated `--location` returns nothing rather than failing** — spell it out:
`"New York, New York, United States"`, `"London, England, United Kingdom"`, or `"United States"`.

`--remote` asks the API for jobs a remote worker can hold. Without it a title search returns mostly
on-site and hybrid, because that is mostly what exists.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A search returns far less than `--max` | Nothing else matched; `--max` is a ceiling | Widen `--since`, or drop `--remote` |
| Everything comes back on-site | No `--remote` | Pass it |
