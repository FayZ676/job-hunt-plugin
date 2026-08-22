# Ingesting

Deriving `prospects` from the raw layer. **Ingest fetches nothing** — it reads what `references/fetching.md`
already stored, rules on every row, and promotes the survivors.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/ingest.py"
```

**One chain serves every source.** No filter names a source: each source normalizes its payload into
the same columns, and a source that cannot state a fact leaves the default, so the filter reading it
simply never trips. A new mechanism inherits every filter for free.

Every row it touches gets a `disposition`, so what a filter costs stays answerable after the run
instead of being a number that scrolled past. Two of them are not drops: `kept` became a prospect,
and `upgraded` replaced a lower-ranked source on a prospect that already existed. Every other value
names the filter that dropped the row.

| Flag | Use |
| ---- | --- |
| `--redo` | rule again on everything, including rows already decided, without re-fetching |
| `--source indeed` | limit to one source |
| `--include-seen` | ignore what is already in `prospects` |
| `--keep-covered` | keep rows whose company a better-ranked source already covers |
| `--no-location-filter` | see what the location rule is costing |
| `--max-age-days 7` | tighten to the last week |
| `--comp-floor N` | override the stored floor for one run |

## The filters

In the order they run. Each applies to every source.

| Filter | Drops |
| ------ | ----- |
| `sponsored` | paid placements — almost entirely gig spam and unrelated listings |
| `expired` | dead listings still in an index, including an unlisted Ashby posting |
| `agency` | reposters, body shops and consultancies, by `agency_blocklist` name or `agency_name_patterns` (`staffing` / `recruiting` / `consulting group` / `outsourcing` / `federal`) |
| `noise` | `title_noise` — "AI Trainer", annotation, tutoring, freelance-gig phrasing |
| `lowball` | a **stated yearly** band topping out below `comp_floor`; catches "Senior AI Engineer" at $31K–47K. A band stated per hour, or not stated at all, is not judged |
| `title` | fails `title_include`, or matches `title_exclude` |
| `location` | fails `location_include`, or matches `location_exclude` without a US anchor. Remote postings skip the include test |
| `stale` | older than `max_age_days` |
| `covered` | a better-ranked source already covers this company — see precedence |
| `seen` | already in `prospects` or `aliases`, by key or by normalized company + title |
| `duplicate` | one role listed in several places, collapsed into the row that was kept |

## Source precedence

Every source carries a rank: an employer's own board is authoritative (`0`), an aggregator is
discovery (`1`). Precedence is a number in `sources.REGISTRY`, which is why ingest resolves overlaps
without any condition naming a source.

- **A lower-ranked copy of a covered company is dropped** as `covered`. Without this, every harvest
  re-proposes roles the boards covered hours earlier.
- **A better-ranked copy that arrives later upgrades the prospect in place** — the same row keeps its
  key, its score and its history, and gains the real description and apply URL. The harvested key
  becomes an alias.

That is the compounding win: a company is discovered once by the aggregator, and fetched properly
from its own board every morning after. It only happens before any application work has started; a
`staged` or `applied` row is never disturbed.

## Dedupe

Three checks, applied to all sources alike:

1. **The key**, against `prospects` and `aliases`.
2. **Source precedence**, as above.
3. **Normalized company + title**, with names normalized past `Inc`/`LLC`/`Technologies`. Same-run
   collisions collapse into one prospect that keeps the better-ranked source and lists every
   location; the siblings become aliases so they never resurface as new.

## Tuning

Ingest prints its drop counts, and because the verdicts are stored they stay queryable:

```bash
$Q "SELECT disposition, COUNT(*) n FROM postings WHERE ingested_on=date('now') GROUP BY disposition"
$Q "SELECT company,title,location FROM postings WHERE disposition='location' LIMIT 20"
```

The second query is the one that matters: **read what a filter actually dropped** rather than
guessing from a count. Then change the rule and re-rule the same postings — no network:

```bash
$Q "SELECT kind, pattern, note FROM filters"
$Q "INSERT INTO filters(kind,pattern,note) VALUES('title_exclude','(?i)contract','no contract roles')"
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/ingest.py" --redo
```

| Symptom | Fix |
| ------- | --- |
| Obvious junk in prospects | add to `title_exclude`, then `--redo` |
| A real role got filtered out | find it with a `disposition` query, then loosen that rule |
| Prospects fine, scores wrong | `search_criteria` and `search_notes`, not filters |
| Too few prospects | check the `location` and `stale` counts first; it is usually location |
| Shortlist fills with staffing firms | `agency_blocklist` is stale — add the names; they repeat daily |
| Same company never has anything | `UPDATE companies SET active=0 WHERE slug='…'` |

**Tune the blocklist as you go.** When a run surfaces a reposter, add it — that is a permanent
improvement, and the list is the main thing between an aggregator and a shortlist full of staffing
firms. A blocklist entry is not a judgment about the employer, only about whether their listings are
worth reading; a company that starts posting directly should come off it.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A role appears twice | Precedence dedupe missed | The company is on the watchlist under a different name — reconcile the spelling |
| A foreign role survives the location filter | The location says only "Remote" | Not catchable mechanically; the description read at scoring is the backstop |
| Nothing pending | Every posting already has a disposition | `--redo` re-rules them, or fetch again |
| A filter change seems to do nothing | Rows were already decided | `--redo`; without it only pending rows are considered |
