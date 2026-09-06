# Searching

Finding the openings. `job-search` does the whole action — every career site in `companies`
crawled, everything that came back stored as it arrived, then every stored row ruled and the
survivors promoted to prospects. Storing is not a step you run; the raw layer is kept so a rule's
cost stays queryable, not so you can re-fetch it.

Each board is read straight off the employer's own ATS. No key, no quota, no bill, and every row's
`url` is the employer's posting with the description already attached. **What is not registered is
never searched** — reach is the registry's job, not the search's, so a role that never arrives is
usually a missing employer rather than a wrong argument.

## Who gets crawled

`job-companies` owns the registry. `job-companies add` takes a name, an ATS board slug, or a
careers URL, probes every plugged-in ATS, and registers whichever answers — so an employer can be
added from nothing more than the user naming them.

```bash
job-companies add --file assets/companies.txt   # the shipped starting point
job-companies add anthropic
job-companies add https://boards.greenhouse.io/someco
job-companies list
job-companies fetchers                          # which ATSes are plugged in
```

**Register the employers the user names, the moment they name them.** A company mentioned in the
instructions, in passing, or in a rejected posting is one the registry should already hold.

**A name that resolves to the wrong company is the failure to watch for.** Slugs are first-come:
`archer` is a veterinary clinic, not the aircraft maker. `job-companies list` prints what each
board called itself — read it after a bulk add, and `remove` what does not belong.

An ATS the registry cannot reach is one file in `lib/core/fetch/ats`. Nothing else in the codebase
names an ATS, so adding one is a file and a probe, not a change to the search.

## What the search is told

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
| `--since` | the user — ask before the call |

**The terms match the title, and nothing else.** A term that never appears in a job title returns
nothing, however well it describes the work; the prose around it in the instructions is for the
scorer. Say them the way a title says them, short and literal, and pass several rather than one.

**`--location` matches the location the board prints**, loosely and in either direction, and a US
state or its abbreviation counts as the United States — so `"United States"` catches
`US, CA, Santa Clara` and `San Francisco, California, United States`.

**Many boards print a bare city.** `San Francisco`, on its own, names no country and so does not
match one, and neither does a role listed only as `Remote`. `--location` is therefore a narrowing
worth passing only when the user genuinely will not take anything else; pass it as several
arguments — the country, the state, and the cities they would work in — or leave it off and let the
scorer read the description.

**Do not narrow location past what the user actually said.** A posting open in both London and New
York is one a US-based user still wants to see; a few foreign rows cost nothing now. The description
read at scoring is the backstop.

`--since` bounds what the crawl keeps, not what it reads: every board is read in full either way, so
a wider window costs time rather than money. `--since 6m` is the backfill worth running on the first
run and rarely again.

**`--max` is a ceiling on what is stored, and there is no reason to set one** beyond keeping a first
run small enough to read.

**A board that fails is reported by name and the run continues** — `unreachable:` lines in the
output are the ones to read. Most ATSes hand over a whole board in one request, so a hundred and
fifty of them take seconds; Workday and SmartRecruiters publish descriptions one posting at a time,
so a registry holding those takes minutes.

## Every row keeps its verdict

**One chain serves every source.** No rule names a source: each normalizes into the same columns,
and one that cannot state a fact leaves the default, so the rule reading it never trips. A new
fetcher inherits every rule for free.

`DISPOSITIONS` in `lib/search.ts` names the verdicts, and `job-search dispositions` prints them in
the order the chain rules them — read it there rather than from a copy.

**What the chain rules on is deliberately small: expiry, the profile's compensation floor, age, and
what has already been seen.** There is no pattern table and no stored filter vocabulary. Anything
that takes judgment about whether a role fits — the title, the seniority, the field, the location,
whether the employer is a reposter — is the scorer's call, made against the instructions with the
full description in hand. Do not reintroduce a local pattern rule to pre-empt it; say it in the
instructions, where it is read once and applied everywhere.

**Only a stated yearly band is judged against the floor**, and most ATSes state nothing. A blank
`compensation` is not a low one.

## Dedupe

Two checks:

1. **The key**, against every row already kept or already pointing at one through `canonical_key`.
2. **Normalized company + title**, with names normalized past `Inc`/`LLC`/`Technologies`. One role
   posted under several locations arrives as several rows; they collapse onto one, preferring a row
   already kept and then a remote one. The siblings are ruled `duplicate` and point at the survivor
   through `canonical_key`, so they never resurface as new. Every location the role was listed under
   stays queryable: `SELECT location FROM postings WHERE canonical_key='<key>'`.

An employer whose board is registered under two ATSes — a live Greenhouse and a stale Ashby, say —
posts the same role twice under different keys. The company + title check collapses them, but the
stale board is still worth removing.

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
| A real role never arrived | the employer is not registered, or the terms miss how the title words it |
| Prospects fine, scores wrong | `instructions` |
| Too few prospects | register more employers first; then check `stale` and widen `--since` |
| Nothing at all from one employer | `job-companies list` — the board may be stale or the wrong company |

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A search returns almost nothing | The registry is small, or the terms do not match how titles are worded | `job-companies list`, then widen the terms |
| A role appears twice | The employer is registered under two ATSes and spells its name differently on each | Reconcile the spelling, or remove the stale board |
| A foreign role arrives despite `--location` | The location says only "Remote" | Not catchable mechanically; the description read at scoring is the backstop |
| `unreachable:` on the same board every run | The board moved or closed | Re-add the employer from its current careers URL |
