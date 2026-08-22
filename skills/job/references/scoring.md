# Scoring and the record

There is one record: the `prospects` table. Scoring writes to it, status changes write to it, and
"what happened" is read back out of it.

## Score

`search_criteria` is the rubric; `search_notes` carries the judgement it cannot encode. Read both,
then take the triage list — title, company, location, compensation and age, and **no description
column at all**, which is the point:

```bash
$Q "SELECT * FROM triage WHERE status='new'"
```

Triage on that, then pull only what survives:

```bash
$Q "SELECT key, description FROM prospects WHERE key IN ('…','…','…')"
```

- **Read the description before scoring.** Scoring off the title is the failure this step exists to
  prevent. A "Software Engineer" JD that is 80% LLM work beats a "Senior AI Engineer" req that is
  really data plumbing.
- **Every score cites the specific JD language that drove it**, quoted or named, in `reason`.
- **Apply dealbreakers first.** A dealbreaker is a hard zero regardless of how well the rest reads.
- Where a score turns on something still `NULL` in the profile, score on a stated assumption and say
  so in the reason.
- **Score every prospect, including the ones you skip** — an unscored row stays `new` and comes back
  tomorrow.

```sql
UPDATE prospects SET score=9, reason='JD leads with production LLM evaluation harnesses'
WHERE key='greenhouse:anthropic:401';
```

Setting `score` sets the status against `shortlist_threshold`, so the two can never disagree. A
trigger appends to `events` on every status change, so history stays intact without any caller
remembering to write it. Add a note only when the transition alone does not say enough:

```sql
INSERT INTO events(key,status,note) VALUES('…','rejected','3 days, no interview — resume screen');
```

## Answering questions

The reason this is a database: the user asks, and you answer with a query rather than by reading
files.

```bash
$Q "SELECT * FROM stats"
$Q "SELECT company, title, score FROM prospects WHERE status='applied' ORDER BY score DESC"
$Q "SELECT company, COUNT(*) n FROM prospects WHERE status='rejected' GROUP BY company ORDER BY n DESC"

# how fast rejections come back, and whether an interview happened first
$Q "SELECT p.company, p.title,
           CAST(julianday(r.at) - julianday(a.at) AS INT) AS days,
           EXISTS(SELECT 1 FROM events i WHERE i.key=p.key AND i.status='interviewing') AS interviewed
    FROM prospects p
    JOIN events a ON a.key=p.key AND a.status='applied'
    JOIN events r ON r.key=p.key AND r.status='rejected'
    ORDER BY days"
```

## The run report

There is no report command — the note is a rendering. Query what you need and write the markdown to
`career/runs/<date>.md` when the user wants something to read. Deleting it loses nothing.

```bash
$Q --json "SELECT company,title,score,status,reason,url,resume FROM prospects WHERE first_seen=date('now')"
```
