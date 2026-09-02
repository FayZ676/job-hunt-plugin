# Searching

Phase 1: finding the openings. `job-search` does the whole phase — one paid Apify call, everything
that came back stored as it arrived, then every stored row ruled and the survivors promoted to
prospects. Storing is not a step you run; the raw layer is kept so a filter's cost stays queryable,
not so you can re-fetch it.

The actor indexes 175k company career sites across 54 ATSes — Greenhouse, Lever and Ashby, and also
Workday, iCIMS, SuccessFactors, Oracle Cloud, BambooHR, Rippling, SmartRecruiters, Eightfold. There
is no ATS left to check by hand, and no aggregator in the path: every row's `url` is the employer's
own posting, with the description already attached.

## The bill is the filter

**Billing is per job returned, so a filter the API can apply is money, and a filter applied after the
call is money already spent.** Every filter that can be pushed into the request already is:

| Local filter | Rides along as | Note |
| ------------ | -------------- | ---- |
| what you searched for | `titleSearch` | |
| `title_exclude`, `title_noise` | `titleExclusionSearch` | the regex alternations are flattened into literal terms; a pattern with no closing `\b` becomes a `:*` prefix match |
| `agency_blocklist` | `organizationExclusionSearch` | alongside the API's own `removeAgency` |
| `max_age_days` | `--since` | |

A pattern too complex to flatten safely — a character class, a quantifier, a bare alternation — is
left to the local rules rather than guessed at.

**`location_exclude` is deliberately NOT pushed.** A posting open in both London and New York is one
the local rule keeps on its US anchor, and an API-side exclusion would drop it before anyone saw it.
Paying for a few foreign rows is cheaper than never seeing a US job.

The chain still rules on everything that comes back — the request narrows, the local rules decide. The one
thing the request cannot know is `title_include`, so **the run warns when a searched title could
not survive it**: those jobs are bought and then dropped. Fix the disagreement in one direction or
the other; do not pay for it twice a week.

**What you search for comes off `job-score instructions`** — the same words the scorer reads, so
discovery and scoring cannot drift apart. Say them the way a search box wants them, short and
literal; the prose around them is for the scorer, not for the API.

`--since 6m` is the backfill worth running once, on the first run, and rarely again.

**A misspelled or abbreviated `--location` returns nothing rather than failing** — spell it out:
`"New York, New York, United States"`, `"London, England, United Kingdom"`, or `"United States"`.

**Pass `--remote` or most of what comes back is on-site**, because that is mostly what exists.

## Every row keeps its verdict

**One chain serves every source.** No filter names a source: each normalizes into the same columns,
and one that cannot state a fact leaves the default, so the filter reading it never trips. A new
mechanism inherits every filter for free.

Every row gets a `disposition`, so what a filter cost stays answerable after the run. `kept` is the
only one that is not a drop; every other value names the filter that dropped the row.

**Part of this chain runs before the call.** The title and agency filters ride along in the search
request, so a drop count near zero means the pushdown worked, not that the filter is dead.

`job-search rule` is the free half: the same chain over stored postings, for after a filter change.

## The filters

Two things share the word. `DISPOSITIONS` in `lib/search.ts` names the **verdicts** — one per branch of
the chain, and the same values `postings.disposition` stores. The `filters` **table** holds the
**patterns** those branches match on, keyed by `kind`. Only four verdicts read the table; the rest
rule on columns, dates and prior state, so neither describes the other.

`job-search dispositions` prints the verdicts in the order the chain rules them, straight off the
code that applies it — read it there rather than from a copy. The patterns live in
`SELECT kind, pattern, note FROM filters`, so tuning is SQL, not a code change.

## Dedupe

Two checks:

1. **The key**, against every row already kept or already pointing at one through `canonical_key`.
2. **Normalized company + title**, with names normalized past `Inc`/`LLC`/`Technologies`. One role
   posted under several locations arrives as several rows; they collapse onto one, preferring a row
   already kept and then a remote one. The siblings are ruled `duplicate` and point at the survivor
   through `canonical_key`, so they never resurface as new. Every location the role was listed under
   stays queryable: `SELECT location FROM postings WHERE canonical_key='<key>'`.

## Tuning

A run prints its drop counts, and because the verdicts are stored they stay queryable:

```bash
$Q "SELECT disposition, COUNT(*) n FROM postings WHERE ingested_on=date('now') GROUP BY disposition"
$Q "SELECT company,title,location FROM postings WHERE disposition='location' LIMIT 20"
```

The second query is the one that matters: **read what a filter actually dropped** rather than
guessing from a count. Then change the rule and re-rule the same postings, with no network:

```bash
$Q "SELECT kind, pattern, note FROM filters"
$Q "INSERT INTO filters(kind,pattern,note) VALUES('title_exclude','(?i)contract','no contract roles')"
job-search rule --redo
```

| Symptom | Fix |
| ------- | --- |
| Obvious junk in prospects | add to `title_exclude`, then `--redo` |
| A real role got filtered out | find it with a `disposition` query, then loosen that rule |
| Prospects fine, scores wrong | `instructions`, not filters |
| Too few prospects | check the `location` and `stale` counts first; it is usually location |
| Shortlist fills with staffing firms | `agency_blocklist` is stale — add the names; they repeat daily |

**Tune the blocklist as you go.** When a run surfaces a reposter, add it — the list is the main thing
between an aggregator and a shortlist full of staffing firms. An entry judges the listings, not the
employer; a company that starts posting directly comes off it.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A search returns far less than `--max` | Nothing else matched; `--max` is a ceiling, not a target | Widen `--since`, or drop `--remote` |
| A role appears twice | Precedence dedupe missed | The index spells the company differently on each row — reconcile the spelling |
| A foreign role survives the location filter | The location says only "Remote" | Not catchable mechanically; the description read at scoring is the backstop |
