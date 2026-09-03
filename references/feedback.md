# Feedback

The argument is what the user said was wrong, in their words. Sent from the run page about anything,
or from a job's page — which prefixes the posting it was sent from, so the rest of the argument is
only their complaint.

**The complaint is a symptom; the deliverable is the change that stops it recurring.** Nothing is
stored to act on later: the argument is the whole input, and a run that ends without an edit has
lost it.

## What one complaint is worth

**Generalise to the criterion, never to the posting.** "This is a senior position and I don't want
senior" is a standing rule about seniority; it is not a rule about this company. A change that only
prevents this one row will be asked for again next week.

**Do not over-generalise either.** One posting is one data point. "The summary oversells my Postgres
work" says the summary was wrong here, not that Postgres should never appear. Where the words bear
two readings that lead to different edits, **ask which** — a wrong rule in `instructions.text`
silently mis-scores every posting after it.

## Where a change lands

In this order. The first that fits is right, because each is cheaper than the next.

| The complaint says | Change |
| ------------------ | ------ |
| A pattern that should never have been fetched — a title they never take, a country, an agency | A `filters` row. Cheapest: spent before the search bills for it |
| A fact a form asks for as a field — the floor, remote, relocation, employment type | The `identity` column, with `job-profile set` |
| A number, date, title or qualifier on their own history is wrong | The `employers` / `projects` / `project_metrics` row it belongs to |
| What counts, what is a mark against, what is a hard stop, and how those trade | `instructions.text` |
| The resume said it badly, and the facts behind it were right | `references/resume.md` |
| Any other action produced the wrong thing by following this skill | That action's reference file |

**`instructions.text` is their prose, in their voice.** Add the sentence the complaint earns and
leave the rest alone — no rewriting around it, no number they did not give. Read before writing;
they may have edited it on the Profile page since.

**Editing this skill's own files is a real outcome, not a fallback.** Resume wording belongs in
`references/resume.md` — a row in **The one-pass test** when it is a line to reject, or a line under
**Writing** when it is a standing habit. A rule written there reaches every future build; a note kept
anywhere else reaches none. What earns a line is in `CLAUDE.md`.

## Report, and record it where it happened

**Say what changed and where, in the terms they used** — the run output is the only proof they get
that being specific was worth it, so "updated the profile" is not a report. This is the exception to
the chat rule in `SKILL.md`: a feedback run always answers.

Say so plainly when nothing should change — a hard stop already written down, a one-off they are not
asking to generalise. Inventing an edit to look responsive is worse than saying no.

Where the complaint came from a posting, record it against that posting so the next reader of its
history knows why it stopped moving:

```sql
INSERT INTO events(key,note) VALUES('<key>','<what they said, and what changed>');
```

**A complaint that rejects the posting is a decision about it.** Set it `not_pursued` — they have no
other way to clear a row they have ruled out — unless they said otherwise.

## After a change of criteria

Changing `instructions.text` or a `filters` row leaves every score on the board built on criteria
that no longer apply. **Re-scoring** in `references/scoring.md` says what to clear, and
`job-search rule --redo` re-rules what is stored without spending again. **Report it and leave it to
them**: one correction is a thin reason to throw away a morning's shortlist.
