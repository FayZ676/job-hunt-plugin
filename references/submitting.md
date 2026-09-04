# Submitting

`job-stage` filled the form; only `job-submit` submits, and only what the user named in this run.

## Which ones

Submitting only, and only for applications the user named. **A key given with the command is that
naming** — submit that one and nothing else, with no table and no question. Otherwise present every
staged application in one table — company, title, score, status, and whatever is named in
`blocked_on` (`job-submit review`). Keep it to that table; the user reads the applications themselves
in the dashboard. Then ask which to submit, accepting "all", a subset, or none.

## The click

```
browser_click    → the submit button
browser_wait_for → confirmation text
browser_snapshot
```

A confirmation reads like "Thank you for applying" or "Application received", usually with the page
replaced. Snapshots save to `.playwright-mcp/` rather than returning inline — read the file the tool
names. **Validation errors mean nothing was submitted** — repair the named fields and re-present the
application for approval; never resubmit silently. Then `job-submit record`, quoting a confirmation
you have seen in a snapshot.

**On a Lever posting, the user clicks.** hCaptcha gates the submit button, and the challenge is
never attempted — a captcha is an explicit request for a person. Hand the open tab over.

## Recording what comes back

Only what the user reports. Do nothing for a role that is merely quiet.

`job-submit rejected` takes the shape in `--note` — days from submission, and whether any interview
stage happened. **When they report an interview instead, move the row on** — nothing else writes
this status, and a row left at `applied` reads as unanswered:

```sql
UPDATE postings SET status='interviewing' WHERE key='<key>';
```
