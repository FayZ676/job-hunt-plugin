---
name: job
description: Scan job boards for new openings, score them against the search profile, build a tailored resume for each shortlist, fill the application form, and submit what the user approves. Use for "run the job routine", "scan and apply", "any new openings", "apply to these", the morning job search, or a resume tailored to one posting. `/job setup` on first use.
---

# Job routine

**scan → score → resume → stage → submit.** The deliverable is submitted applications, recorded. A
run that stages four and submits none has not finished; it is waiting on the user.

## Invariants

Nothing below overrides these.

1. **Everything up to the submit click is unattended. The submit click never is.** Submit only what
   the user names, in that run. Silence is not approval, and an unapproved application stays staged
   rather than going out on a later run.
2. **Never write an answer the profile does not support.** `NULL` is a hard stop: leave the field
   empty and report it — `SELECT * FROM unanswered` lists every one that will block an application.
   Never infer a phone number, a salary, or a demographic answer.
3. **Answer to the truth, including when it costs the application.** A commitment in the profile is
   a ceiling, not an opening position.
4. **`applied` requires a confirmation page you have seen.** Clicking the button is not evidence.
5. **Essays and screening answers are drafted, never auto-accepted.**
6. **Chat output is minimal.** Only two things belong in chat: the Phase 5 approval prompt, and
   whatever blocks progress and needs the user — named specifically, which role and which field. No
   progress narration, no phase transitions, no summaries; the run entry is the record. A run with
   nothing to ask about produces no chat output at all.

## Modes

| Invocation | Runs |
| ---------- | ---- |
| `/job setup` | First-run setup — `references/setup.md` |
| `/job` | All five phases |
| `/job scan` | Phases 1–2 (`--no-indeed` for watched boards only) |
| `/job indeed` | The Indeed pass alone, merged into the day's prospects |
| `/job resume <JD, URL, or key>` | Phase 3 for one role |
| `/job apply <key or URL>` | Phases 3–4 for one role, stopping before submit |
| `/job submit` | Phase 5 over whatever is already staged |

**If `career/` does not exist, run setup first** — `/job` on an unconfigured directory is a no-op.

## Storage

One convention: `career/.state/job.db`. Postings, prospects, companies, filters, staged
applications, history, and the user's whole profile — identity, experience, search criteria — are
rows in it.

**Two layers, one direction.** `postings` is everything a fetch returned, unjudged. `prospects` is
what ingest kept, and the only table the later phases touch. Every posting carries a `disposition`
naming the filter that ruled on it, so "what did that filter cost me" is a query, and a changed
filter re-runs over what is already stored instead of going back to the network.

```bash
Q='python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/q.py"'
$Q --schema                                        # the manual: tables, views, CHECKs, triggers
$Q "SELECT * FROM triage WHERE status='new'"
$Q --json "SELECT * FROM needs_review"
```

`$Q` is shorthand for that path throughout this skill and its references. Shell state does not
survive between tool calls, so put the assignment on the same command line as the query, or write
the path out.

**Read `--schema` before writing SQL.** It carries the rules — `CHECK`s reject a bad status or an
out-of-range score, so there is no way to write an invalid row. Three behaviors it encodes and you
must not fight:

- **Triggers write `events`** on insert and on every status change. Never insert there yourself,
  except to add a `note` the transition alone does not say.
- **Setting `score` sets `status`** against `shortlist_threshold`, so a score and a shortlist
  decision cannot disagree.
- **`triage` omits `description` on purpose.** A day's descriptions run to tens of thousands of
  tokens and most belong to roles triage already ruled out. Pull them one at a time, for survivors
  only. `SELECT * FROM prospects` is almost always a mistake, and `SELECT * FROM postings` more so.

The filesystem holds only what a database should not: built PDFs in `career/resumes/`, moved to
`submitted/` when an application goes out. That is output; deleting it loses nothing.

**Never write run notes or daily summaries to disk.** The database is the record. Reporting is a
query answered in the conversation — see `references/scoring.md`.

**The user never opens a file and never writes SQL.** Reading their career history, correcting a
fact, changing what they want — conversation on their side, rows on yours (`references/profile.md`).
When they ask about their search — what they applied to, what went quiet, which companies reject
fastest — **answer with a query.**

## Phase 1 — Fetch, then ingest

Two steps, and they stay separate. Fetching judges nothing; ingest fetches nothing.

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/job/scripts"
python3 "$S/fetch.py" boards                                  # every watched board, in parallel
python3 "$S/fetch.py" harvest --source indeed --file <harvest.json>
python3 "$S/ingest.py"                                        # postings -> prospects
```

**Every source is the same after fetching.** A source normalizes its payload into `postings` and
ingest rules on all of them with one chain of filters — no filter knows which source a row came
from. Adding a mechanism is a line in `sources.REGISTRY`; nothing downstream changes.

The Indeed harvest is the one source a browser has to collect, because Indeed throttles `fetch()`
but not navigation. **Read `references/fetching.md` before running it.** Its descriptions arrive
after ingest, for kept rows only: `fetch.py descriptions --file <descs.json>`.

Re-running either step is free. Ingest re-rules without re-fetching:

```bash
python3 "$S/ingest.py" --redo --no-location-filter   # what is the location rule costing?
```

Companies on Workday, iCIMS and the like are rows with `ats='manual'` and a cadence; `manual_boards`
lists what is due. Check those, `INSERT` finds into `prospects` directly, and set `last_checked`.
When a find resolves to a supported ATS, `INSERT` it into `companies` — found by hand once, fetched
every morning after.

Sources, slugs and the harvest: `references/fetching.md`. Filters, precedence and tuning:
`references/ingesting.md`.

## Phase 2 — Score

```bash
$Q "SELECT * FROM triage WHERE status='new'"
```

Triage that list against `search_criteria` (the rubric) and `search_notes` (the judgement the schema
cannot hold), pull descriptions for the plausible ones, then score:

```bash
$Q "UPDATE prospects SET score=9, reason='the JD language that drove it, quoted' WHERE key='…'"
```

**Anything you score must have had its description read** — scoring off a title is the failure this
phase exists to prevent. **Every prospect gets scored**, including the ones you skip; an unscored row
stays `new` and comes back tomorrow. Dealbreakers are a hard zero regardless of how well the rest
reads. Full method: `references/scoring.md`.

## Phase 3 — Resume

For each shortlisted role, build a tailored one-page PDF. `references/resume.md` carries the
selection method, the writing rules, the one-pass test, and the facts that must never be misreported.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/render.py" career/resumes/<slug>.json career/resumes/<slug>.pdf --density tight
pdftoppm -jpeg -r 95 career/resumes/<slug>.pdf /tmp/page      # then read /tmp/page-1.jpg
```

**Read the rendered image before moving on.** A resume that never got looked at is not ready to
attach. Then `UPDATE prospects SET resume='career/resumes/<slug>.pdf'`.

## Phase 4 — Stage

Fill the form completely and stop with a finger over the button. **Read `references/applying.md`
first** — reaching the form per ATS, field patterns, typeaheads, uploads, and the traps.

Every field is one of three tiers, and the tier decides who answers it:

| Tier | What it is | Source | Auto-filled |
| ---- | ---------- | ------ | ----------- |
| **Identity** | Name, email, phone, location, LinkedIn, GitHub, resume upload | `profile` | Yes |
| **Policy** | Work authorization, sponsorship, start date, compensation, EEO | `profile` | Yes |
| **Judgment** | Screening questions, essays, "why this company" | Nothing stored | No — drafted and flagged |

A judgment question gets the answer the profile supports. Where nothing supports one, flag it for the
user, **except** when a row in `projects` plainly answers it — then answer, cite that project, and
flag `evidence-backed` so the review can check the reasoning. A question needing a project that is
not in `projects` is a flag, not an inference.

Attach the PDF, screenshot the completed form, then record it:

```bash
$Q "INSERT INTO staged(key,url,ats,screenshot,status) VALUES('…','<apply-url>','ashby','<png>','ready');
    INSERT INTO staged_fields(key,label,value,tier,flag) VALUES
      ('…','Do you have the legal right to work without sponsorship?','Yes','policy',NULL),
      ('…','Tell us about an AI product you built…','…','judgment','needs-review');
    UPDATE prospects SET status='staged' WHERE key='…'"
```

`ready` means every field is filled; `blocked` means a `NULL` in the profile or a question nothing
answers — name what is missing in `blocked_on`. Keep the browser tab open; the staged rows survive a
lost session and refilling from them is cheap.

## Phase 5 — Review and submit

Present every staged application in one table — company, title, score, status, and any field flagged
`needs-review` or `blocked` (`SELECT * FROM needs_review`). **Show every drafted essay in full**; an
essay the user has not read is an essay they did not write. That table and its essays *are* the
approval prompt. Then ask which to submit, accepting "all", a subset, or none.

For each approved one: click submit, wait for the confirmation page, and **verify it**. A validation
error means nothing was submitted — repair the named field and re-present it. Then:

```bash
$Q "UPDATE prospects SET status='applied', resume='career/resumes/submitted/<slug>.pdf' WHERE key='…'"
```

and move that resume's `.pdf` and `.json` into `career/resumes/submitted/`. The status change and the
file move go together.

## Recording a rejection

Only a reported rejection. Do nothing for a role that is merely quiet.

```bash
$Q "UPDATE prospects SET status='rejected', resume=NULL WHERE key='…';
    INSERT INTO events(key,status,note) VALUES('…','rejected','3 days, no interview — resume screen')"
```

Then **delete that resume's `.pdf` and `.json` from `career/resumes/submitted/`**, so the record
still says an application went out while the dead document is gone. Note the shape when it is
visible — days from submission, and whether any interview stage happened; a rejection three days out
with no interview is a resume screen, and that is worth knowing across roles. **A synced folder can
re-materialize a deleted file** — re-list the directory and delete again if it reappeared.
