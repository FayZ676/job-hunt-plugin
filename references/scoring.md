# Scoring

Phase 2: judging every prospect against the profile. Prospects in, a score and the sentence that
earned it out. Nothing here fetches, and nothing here sets a status — the threshold does that.

## What scoring reads

Two inputs, and `job-score instructions` prints both: the standing facts assembled off `identity` —
where they live, what they will not go below, whether they need sponsorship — and `instructions.text`,
their own prose.

**The prose carries no numbers.** It says in its own words what counts for how much, what is a hard
stop, and what the search should ask for. Nothing is added up; the score is a judgement those inform.
It is theirs, edited on the Profile page, so when a score and the prose disagree **the prose is right
and the score is wrong** — do not quietly compensate for prose you would have written differently.

## The order of a run

1. **Triage first, on titles and locations.** `triage` carries no descriptions on purpose: pulling a
   hundred descriptions to learn that eighty are the wrong role is the expensive way to read a title.
2. **Read the description of everything you will score.** Scoring off a title is the failure this
   phase exists to prevent — a "Software Engineer" JD that is 80% LLM work beats a "Senior AI
   Engineer" req that is really data plumbing.
3. **Apply the hard stops first.** One of theirs is a zero regardless of how well the rest reads, and
   no amount of good elsewhere trades against it.
4. **Score every prospect, the rejects included.** An unscored row stays `new` and comes back
   tomorrow, so skipping the obvious no is a decision you pay for again every morning.

## The scale

`settings.shortlist_threshold` — 7 by default — is the only number the app owns. So the live
question between a 6 and a 7 is not how good the posting is but **whether they should spend an hour
of their morning applying to it.**

Every other gradation comes off their prose, which already ranks what costs nothing, what is a mark
against, and what is a hard stop. Read the ranking there rather than inventing a rubric here.

## The reason

One or two sentences, quoting the JD language that drove the score. It is shown on the job's page in
the dashboard, so it is read later by a person deciding whether to trust the shortlist — and it is
what tells you tomorrow whether a bad shortlist means a wrong score, a stale filter, or prose that
needs a line. A reason that would fit any posting is a score that was not made.

Where the score turns on something still `NULL` — no compensation stated, no location — score on a
stated assumption and say so in the reason.

## Re-scoring

**Nothing re-scores itself.** Editing `instructions.text` leaves every existing score exactly where
it was, and the shortlist stays built on criteria that no longer apply. After a change of criteria,
clear the scores you want judged again — and clear the status with them, because the trigger only
fires when a score is written, so a row left `shortlisted` with a NULL score stays shortlisted:

```bash
$Q "UPDATE postings SET score=NULL, reason=NULL, status='new'
    WHERE disposition='kept' AND status IN ('new','skipped','shortlisted')"
```

Rows already past triage — staged, applied, interviewing — are history, not candidates. Leave them.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Everything lands 7 or 8 | Scoring how good the posting is, not how well it fits them | The profile is the yardstick, not the market |
| The shortlist is too big or too small | The threshold, not the scores | `settings.shortlist_threshold` |
| A hard stop scored well on content | Hard stops were applied last | They are a gate, not a term in a sum |
| Yesterday's shortlist disagrees with today's prose | Old scores survived the edit | Clear score, reason **and** status, then re-score |
