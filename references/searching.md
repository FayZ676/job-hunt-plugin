# Searching

Finding the openings. `job-search` does the whole action — one paid Apify call, everything
that came back stored as it arrived, then every stored row ruled and the survivors promoted to
prospects. Storing is not a step you run; the raw layer is kept so a rule's cost stays queryable,
not so you can re-fetch it.

The actor indexes 175k company career sites across 54 ATSes — Greenhouse, Lever and Ashby, and also
Workday, iCIMS, SuccessFactors, Oracle Cloud, BambooHR, Rippling, SmartRecruiters, Eightfold. There
is no ATS left to check by hand, and no aggregator in the path: every row's `url` is the employer's
own posting, with the description already attached.

## What the search is told

**`--max` is the user's number.** It is the bill, and nothing in the profile sets it — ask what to
spend before the call, on every run.

**Nothing about what to search for is baked into this skill.** Every argument comes off the profile
or off `job-score instructions` — read both, then fill the call. If something belongs in the search
and is in neither, that is the gap: decide whether it is a profile fact or a line the user should add
to their instructions, and ask.

| Argument | Comes from |
| -------- | ---------- |
| the terms | the titles named in `instructions` — the same words the scorer reads |
| `--not-title` | titles the instructions rule out |
| `--not-company` | employers the instructions rule out — reposters, body shops, a former employer |
| `--location` | `identity.location`, and what the instructions say about where they will work |
| `--remote` | `identity.remote_preference` |
| `--since` | the widest window `max_age_days` allows, unless the user names one |

**Billing is per job returned, so an exclusion pushed into the request is money, and one applied
after the call is money already spent.** `--not-title` and `--not-company` become
`titleExclusionSearch` and `organizationExclusionSearch`, alongside the API's own `removeAgency` —
so a title or an employer the instructions rule out never bills. Pass them; do not rely on the
scorer to swallow the cost.

Say the terms and exclusions the way a search box wants them, short and literal; the prose around
them in the instructions is for the scorer, not for the API.

`--since 6m` is the backfill worth running once, on the first run, and rarely again.

**A misspelled or abbreviated `--location` returns nothing rather than failing** — spell it out:
`"New York, New York, United States"`, `"London, England, United Kingdom"`, or `"United States"`.

**Do not narrow location past what the user actually said.** A posting open in both London and New
York is one a US-based user still wants to see; paying for a few foreign rows is cheaper than never
seeing a job. The description read at scoring is the backstop.

## Every row keeps its verdict

**One chain serves every source.** No rule names a source: each normalizes into the same columns,
and one that cannot state a fact leaves the default, so the rule reading it never trips. A new
mechanism inherits every rule for free.

`DISPOSITIONS` in `lib/search.ts` names the verdicts, and `job-search dispositions` prints them in
the order the chain rules them — read it there rather than from a copy.

**What the chain rules on is deliberately small: expiry, the profile's compensation floor, age, and
what has already been seen.** There is no pattern table and no stored filter vocabulary. Anything
that takes judgment about whether a role fits — the title, the seniority, the field, the location,
whether the employer is a reposter — is the scorer's call, made against the instructions with the
full description in hand. Do not reintroduce a local pattern rule to pre-empt it; push the exclusion
into the request instead, where it saves money, or say it in the instructions, where it is read once
and applied everywhere.

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
$Q "SELECT company,title,location FROM postings WHERE disposition='stale' LIMIT 20"
```

The second query is the one that matters: **read what a rule actually dropped** rather than guessing
from a count. Re-ruling the same postings costs no network:

```bash
job-search rule --redo
```

| Symptom | Fix |
| ------- | --- |
| Obvious junk in prospects | name it in `instructions`, then pass it as `--not-title` next run |
| A real role never arrived | the terms or `--not-title` were too narrow, or `--since` too short |
| Prospects fine, scores wrong | `instructions` |
| Too few prospects | check the `stale` count, then widen `--since` or `--location` |
| Shortlist fills with staffing firms | add the names to `instructions`, and pass `--not-company` |

**Reposters repeat daily.** When a run surfaces one, it belongs in the instructions the same day —
that is the main thing between an aggregator and a shortlist full of staffing firms. It judges the
listings, not the employer; a company that starts posting directly comes back out.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A search returns far less than `--max` | Nothing else matched; `--max` is a ceiling, not a target | Widen `--since`, or drop `--remote` |
| A role appears twice | Precedence dedupe missed | The index spells the company differently on each row — reconcile the spelling |
| A foreign role arrives despite `--location` | The location says only "Remote" | Not catchable mechanically; the description read at scoring is the backstop |
