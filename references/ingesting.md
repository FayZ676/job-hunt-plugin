# Ingesting

Deriving `prospects` from the raw layer. **Ingest fetches nothing** — it reads what the fetch
already stored, rules on every row, and promotes the survivors.

## Contents

- The filters — the verdicts in `cli/scan.ts` versus the patterns in the `filters` table
- Dedupe — the two checks, and where the collapsed siblings go
- Tuning — reading the drop counts, and querying what a verdict cost
- Traps — a role appearing twice, "Remote" defeating the location filter, `--redo`

```bash
job-scan ingest
```

**One chain serves every source.** No filter names a source: each normalizes into the same columns,
and one that cannot state a fact leaves the default, so the filter reading it never trips. A new
mechanism inherits every filter for free.

Every row gets a `disposition`, so what a filter cost stays answerable after the run. `kept` is the
only one that is not a drop; every other value names the filter that dropped the row.

**Part of this chain runs before the fetch.** The title and agency filters ride along in the search
request, so a drop count near zero means the pushdown worked, not that the filter is dead.

```bash
job-scan ingest --help      # every flag
job-scan dispositions   # every verdict, in order
```

## The filters

Two things share the word. `DISPOSITIONS` in `cli/scan.ts` names the **verdicts** — one per branch of
the chain, and the same values `postings.disposition` stores. The `filters` **table** holds the
**patterns** those branches match on, keyed by `kind`. Only four verdicts read the table; the rest
rule on columns, dates and prior state, so neither describes the other.

`job-scan dispositions` prints the verdicts in the order the chain rules them, straight off the
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

Ingest prints its drop counts, and because the verdicts are stored they stay queryable:

```bash
$Q "SELECT disposition, COUNT(*) n FROM postings WHERE ingested_on=date('now') GROUP BY disposition"
$Q "SELECT company,title,location FROM postings WHERE disposition='location' LIMIT 20"
```

The second query is the one that matters: **read what a filter actually dropped** rather than
guessing from a count. Then change the rule and re-rule the same postings, with no network:

```bash
$Q "SELECT kind, pattern, note FROM filters"
$Q "INSERT INTO filters(kind,pattern,note) VALUES('title_exclude','(?i)contract','no contract roles')"
job-scan ingest --redo
```

| Symptom | Fix |
| ------- | --- |
| Obvious junk in prospects | add to `title_exclude`, then `--redo` |
| A real role got filtered out | find it with a `disposition` query, then loosen that rule |
| Prospects fine, scores wrong | `search_criteria`, not filters |
| Too few prospects | check the `location` and `stale` counts first; it is usually location |
| Shortlist fills with staffing firms | `agency_blocklist` is stale — add the names; they repeat daily |

**Tune the blocklist as you go.** When a run surfaces a reposter, add it — the list is the main thing
between an aggregator and a shortlist full of staffing firms. An entry judges the listings, not the
employer; a company that starts posting directly comes off it.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A role appears twice | Precedence dedupe missed | The index spells the company differently on each row — reconcile the spelling |
| A foreign role survives the location filter | The location says only "Remote" | Not catchable mechanically; the description read at scoring is the backstop |
| Nothing pending | Every posting already has a disposition | `--redo` re-rules them, or fetch again |
| A filter change seems to do nothing | Rows were already decided | `--redo`; without it only pending rows are considered |
