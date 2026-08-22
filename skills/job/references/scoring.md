# Scoring and the record

There is one record: the `prospects` table. Scoring writes to it, status changes write to it, and
"what happened" is read back out of it.

## Score

Read `career/profile.json` in full — the `search` block is the rubric and `search.notes` carries the
judgement it cannot encode. Then take the triage list:

```bash
DB='python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/db.py"'
$DB list --new
```

That view has title, company, location, compensation and age. **It has no descriptions**, which is
deliberate: a day's descriptions run to tens of thousands of tokens and most belong to roles the
list already rules out.

Triage on it, then pull only what survives:

```bash
$DB describe <key> <key> <key>
```

- **Read the description before scoring.** Scoring off the title is the failure this step exists to
  prevent. A "Software Engineer" JD that is 80% LLM work beats a "Senior AI Engineer" req that is
  really data plumbing.
- **Every score cites the specific JD language that drove it**, quoted or named, in `--reason`.
- Apply dealbreakers first. A dealbreaker is a hard zero regardless of how well the rest reads.
- Where a score turns on something still `null` in the profile, score on a stated assumption and say
  so in the reason.

```bash
$DB score <key> --score 9 --reason "JD leads with production LLM evaluation harnesses"
```

At or above the profile's `shortlist_threshold` this sets `shortlisted`; below it, `skipped`.
**Score every prospect, including the ones you skip** — an unscored row stays `new` and comes back
tomorrow.

## Status

```bash
$DB status <key> --status applied --resume career/resumes/submitted/<slug>.pdf --note "confirmation verified"
```

Vocabulary, roughly in lifecycle order: `new` · `scored` · `shortlisted` · `skipped` · `staged` ·
`applied` · `interviewing` · `rejected` · `not_pursued` · `closed`.

Every change appends to `events`, so the history is intact without duplicating the row. `db.py show
<key>` prints a prospect with its full timeline.

## Answering questions

The reason this is a database: the user can ask things, and you answer with a query rather than by
reading files.

```bash
$DB stats
$DB query "SELECT company, title, score FROM prospects WHERE status='applied' ORDER BY score DESC"
$DB query "SELECT company, COUNT(*) n FROM prospects WHERE status='rejected' GROUP BY company"
$DB query "SELECT p.company, p.title, julianday(e2.at) - julianday(e1.at) AS days
           FROM events e1 JOIN events e2 ON e1.key = e2.key
           JOIN prospects p ON p.key = e1.key
           WHERE e1.status='applied' AND e2.status='rejected'"
```

That last one answers "how fast do rejections come back, and did an interview happen" — the sort of
thing the old append-only file could not be asked at all.

## The run report

```bash
$DB report [--date YYYY-MM-DD]
```

Derived from the database, not stored. Write it to `career/runs/<date>.md` when the user wants a
note to read; that file is a rendering, and deleting it loses nothing.
