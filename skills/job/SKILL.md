---
name: job
description: The full daily job routine in one command — scan tracked boards for new openings, score them against the search profile, build a tailored resume for each shortlisted role, fill out its application form in the browser, and submit the ones the user approves. Use for "run the job routine", "scan and apply", "any new openings", "apply to these", or the morning job search. Sub-modes cover scanning, resume building, and applying on their own. `/job setup` creates the career files on first use.
---

# Job routine

Carries a posting from "it exists on a board somewhere" to "the application is submitted."

**scan → score → resume → stage → submit**

**The deliverable is submitted applications, recorded.** A run that stages four and submits none has
not finished; it is waiting on the user.

## Invariants

These hold in every phase. Nothing below overrides them.

1. **Everything up to the submit click is unattended. The submit click never is.** Submit only what
   the user names, in that run. Silence is not approval, and an unapproved application stays staged
   rather than going out on a later run.
2. **Never write an answer `career/profile.json` does not support.** A `null` is a hard stop: leave
   the field empty and report it. Never infer a phone number, a salary, or a demographic answer.
3. **Answer to the truth, including when it costs the application.** A commitment in the profile is a
   ceiling, not an opening position.
4. **`applied` requires a verified confirmation page.** Clicking the button is not evidence.
5. **Essays and screening answers are drafted, never auto-accepted.**
6. **Chat output is minimal.** Only two things belong in chat: the Phase 5 approval prompt, and
   whatever blocks progress and needs the user. No progress narration, no phase transitions, no
   summaries — the run entry is the record. A run with nothing to ask about produces no chat output.

## Modes

| Invocation | Runs |
| ---------- | ---- |
| `/job setup` | First-run setup — see `references/setup.md` |
| `/job` | All five phases |
| `/job scan` | Phases 1–2, ending at the run entry (`--no-indeed` for watched boards only) |
| `/job indeed` | The Indeed pass on its own, merged into the day's candidates |
| `/job resume <JD, URL, or key>` | Phase 3 for one role |
| `/job apply <key or URL>` | Phases 3–4 for one role, stopping before submit |
| `/job submit` | Phase 5 over whatever is already staged |

**If `career/` does not exist, run setup first** — `/job` on an unconfigured directory is a no-op.

## Files

Two things exist. That is the whole storage model.

| Path | What |
| ---- | ---- |
| `career/profile.json` | **The only file the user owns.** Identity, application answers, experience, search criteria. Structured — see `references/profile.md`. |
| `career/.state/job.db` | **Everything else.** Prospects, companies, filters, staged applications, history. SQLite, driven with SQL — see **The database** below. |

Plus `career/resumes/` (built, then `submitted/`) and `career/runs/` if the user wants a run note
written; the note is a rendering of the database, not a record in its own right.

**There are no per-day scan files.** A scan updates `prospects`. "What happened today" is a query,
not a file.

## The database

`career/.state/job.db` is SQLite, and **you drive it with SQL**. There is no command layer to learn:

```bash
Q='python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/q.py"'
$Q "SELECT * FROM triage WHERE status='new'"
$Q --json "SELECT * FROM triage WHERE status='shortlisted'"
$Q --schema                       # the full schema, including what each view is for
```

**The schema carries the rules.** Read it once with `--schema` and you know the whole system:

- `CHECK` constraints reject an invalid status, a score outside 0–10, or an unknown filter kind.
  There is no way to write a bad value, including by hand.
- **Triggers write history.** Inserting a prospect logs a `new` event; changing `status` logs the
  transition. Never insert into `events` yourself.
- **Setting `score` sets the status.** A trigger compares it against `shortlist_threshold` in
  `settings` and writes `shortlisted` or `skipped`, so a score and a shortlist decision cannot
  disagree.

### The views are the read surface

| View | What it is for |
| ---- | -------------- |
| `triage` | Every prospect **without its description**. The scoring list; the column is not in the view, so it cannot leak. |
| `stats` | Counts by status. |
| `manual_boards` | Active `ats='manual'` companies, ordered by cadence. |
| `needs_review` | Staged applications and their flagged fields — the Phase 5 approval prompt. |

**Descriptions come one at a time**, after triage has narrowed the list:

```bash
$Q "SELECT description FROM prospects WHERE key='greenhouse:anthropic:401'"
```

A day's descriptions run to tens of thousands of tokens, and most belong to roles `triage` already
ruled out. `SELECT * FROM prospects` is almost always a mistake.

### Common statements

```sql
-- score (status and history follow automatically)
UPDATE prospects SET score=9, reason='JD leads with production LLM evaluation' WHERE key='…';

-- move a role along
UPDATE prospects SET status='applied', resume='career/resumes/submitted/x.pdf' WHERE key='…';

-- a note against the timeline, when the transition alone does not say enough
INSERT INTO events(key,status,note) VALUES('…','rejected','3 days, no interview — resume screen');

-- watch a company / stop watching one
INSERT INTO companies(slug,ats,name,source) VALUES('anthropic','greenhouse','Anthropic','manual');
UPDATE companies SET active=0 WHERE slug='…';

-- a manual board, and marking one checked
INSERT INTO companies(slug,ats,name,careers_url,cadence,why)
  VALUES('galois','manual','Galois','https://galois.com/careers/','Weekly','formal methods; local');
UPDATE companies SET last_checked=date('now') WHERE slug='galois';

-- tune what the scan returns
INSERT INTO filters(kind,pattern,note) VALUES('title_exclude','(?i)\bcontract\b','no contract roles');
```

When the user asks a question about their search — what they applied to, what went quiet, which
companies reject fastest — **answer it with a query.**

## Phase 1 — Scan

Two sources, one destination: the `prospects` table.

**A. The watched boards.** Run from the project root:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py"
```

Reads the company list and filters out of the database, fetches every active Greenhouse, Lever and
Ashby board in parallel, and inserts what is new. Anything already known — by key or alias — is
skipped, so re-running is free.

**B. Indeed.** Finds who is hiring that no watchlist has. A browser pass:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" filter --raw <raw.json>
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" merge --descriptions <descs.json>
```

`filter` stores survivors with no description yet; fetch descriptions for those only, then `merge`
attaches them. **Read `references/indeed.md` first** — the rule that matters is **navigate to each
search URL, never `fetch()` it**; navigation is not rate-limited, XHR is throttled to 403.

**C. Manual boards.** Companies on Workday, iCIMS and the like are rows with `ats='manual'` and a
cadence. the `manual_boards` view lists them with when each was last checked; check what is due,
record finds with an `INSERT` into `prospects`, and mark the board `UPDATE companies SET last_checked=date('now')`.

When a find resolves to a supported ATS, `INSERT` it into `companies`.
That is the point of the Indeed pass — found by hand once, scanned automatically every morning after.

Read `references/boards.md` for flags and filter tuning.

## Phase 2 — Score

Read `career/profile.json` — the `search` block is the rubric, and its `notes` field carries the
judgement the schema cannot hold. Then:

```bash
$Q "SELECT * FROM triage WHERE status='new'"
```

**Triage on that list, then pull descriptions only for the plausible ones** with
`$Q "SELECT description FROM prospects WHERE key='…'"`. Scoring off a title alone is the failure this phase exists to prevent, so
anything you score must have had its description read; but reading all of them is how a run
burns its context for nothing.

```bash
$Q "UPDATE prospects SET score=9, reason='the JD language that drove it, quoted' WHERE key='…'"
```

`score` sets the status automatically: at or above the profile's `shortlist_threshold` it becomes
`shortlisted`, below it `skipped`. Every prospect gets scored — a skipped one that is never scored
comes back tomorrow as new.

Dealbreakers from the profile are a hard zero regardless of how well the rest reads.

## Phase 3 — Resume

For each shortlisted role, build a tailored resume. `references/resume.md` carries the
selection method, the writing rules, the one-pass test, and the facts that must never be misreported.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/render.py" career/resumes/<slug>.json career/resumes/<slug>.pdf --density tight
pdftoppm -jpeg -r 95 career/resumes/<slug>.pdf /tmp/page
```

**Read the rendered image before moving on.** A resume that never got looked at is not ready to
attach. Then record it: `$Q "UPDATE prospects SET resume='career/resumes/<slug>.pdf' WHERE key='…'"`.

## Phase 4 — Stage

Fill the form completely and stop with a finger over the button. Read `references/applying.md`
first — locating the apply form per ATS, field patterns, typeaheads, file upload, and the traps.

Every field is one of three tiers, and the tier decides who answers it:

| Tier | What it is | Source | Auto-filled |
| ---- | ---------- | ------ | ----------- |
| **Identity** | Name, email, phone, location, LinkedIn, GitHub, resume upload | `identity` in `career/profile.json` | Yes |
| **Policy** | Work authorization, sponsorship, start date, compensation, EEO | `work_authorization`, `availability`, `compensation`, `demographics` | Yes |
| **Judgment** | Screening questions, essays, "why this company", anything conditional on the posting | Nothing stored | No — drafted and flagged |

A judgment question gets the answer the bank supports. Where the bank does not support one, it is
flagged for the user, **except** when a project in `profile.json` plainly answers it — then
answer, cite that project as the evidence, and flag `evidence-backed` so the review can check the
reasoning. A question needing a project not in the profile is a flag, not an inference.

Attach the resume PDF, screenshot the completed form, then record the staging. A helper keeps the
SQL out of the way:

```bash
$Q "INSERT INTO staged(key,url,ats,screenshot,status) VALUES('…','<apply-url>','ashby','<png>','ready');
    INSERT INTO staged_fields(key,label,value,tier,flag) VALUES
      ('…','Name','Ada Lovelace','identity',NULL),
      ('…','Do you have the legal right to work without sponsorship?','Yes','policy',NULL),
      ('…','Tell us about an AI product you built…','…','judgment','needs-review');
    UPDATE prospects SET status='staged' WHERE key='…'"
```

`--status ready` means every field is filled; `blocked` means a `null` in the profile or a question
nothing answers — name what is missing with `--blocked-on`. Keep the browser tab open; the staged
rows survive a lost session and refilling from them is cheap.

## Phase 5 — Review and submit

Present all staged applications in one table: company, title, score, status, and any field flagged
`needs-review` or `blocked`. **Show every drafted essay in full** — an essay the user has not read is
an essay they did not write. This table and its essays *are* the approval prompt; keep scan counts
and phase narration out of it.

Then ask which to submit, accepting "all", a subset, or none.

For each approved application: click submit, wait for the confirmation page, and **verify it**. A
validation error means it was not submitted — repair the named field and re-present it.

Then, for each submitted application:

```bash
$Q "UPDATE prospects SET status='applied', resume='career/resumes/submitted/<slug>.pdf' WHERE key='…'"
```

and move the resume's `.pdf` and `.json` into `career/resumes/submitted/`. The status change and the
file move go together; the database records where the document that went out actually lives.

## Phase 6 — Report

Nothing needed from the user means no chat output. Otherwise say only what is needed and where —
which role, which field, which file — without restating what went cleanly alongside it.

## Recording a rejection

```bash
$Q "UPDATE prospects SET status='rejected' WHERE key='…';
    INSERT INTO events(key,status,note) VALUES('…','rejected','3 days, no interview — resume screen')"
```

Then **delete the resume's `.pdf` and `.json` from `career/resumes/submitted/`** and clear the
pointer with `--resume ""`, so the record still says an application went out while the dead
document is gone. Note the shape in the note when it is visible: days from submission, and whether
any interview stage happened. A rejection three days out with no interview is a resume screen, and
that is worth knowing across roles — it is also now a query.

**A synced folder can re-materialize a deleted file.** Re-list the directory after deleting and
delete again if it reappeared.

Only a reported rejection triggers this. Do nothing for a role that is merely quiet.


## Failure modes

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Form fields missing from the snapshot | Form renders after page load | Wait for the loading text to clear, re-snapshot |
| Every staged application `blocked` | Profile still has `null`s | Fill them in `career/profile.json` once |
| Same posting staged twice | Never scored, so it re-entered as new | Phase 2 scores every prospect, including skips |
| Zero candidates from thousands of postings | Filters too tight | Read the per-filter drop counts; usually location. the `filters` table to adjust |
| Login wall on the apply form | Company requires an account | Stage what is reachable, flag the rest |
| Indeed returns 429 or 403 | The pass used `fetch()` | Navigate to each URL instead |
| Indeed re-proposes a watchlist role | Company name differs from its `companies` row | Reconcile the spelling so dedupe matches |
