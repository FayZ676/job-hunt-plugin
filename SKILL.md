---
name: job
description: Scans job boards for new openings, scores them against the search profile, builds a tailored resume for each shortlist, fills the application form, and submits what the user approves. Use when the user says "run the job routine", "scan and apply", "any new openings", "apply to these", asks for the morning job search, or wants a resume tailored to one posting. `/job setup` on first use, `/job help` for the command list.
argument-hint: [setup|scan|indeed|resume <JD|url|key>|apply <key|url>|submit|ui|help]
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
   nothing to ask about produces no chat output at all. `/job help` is the one exception.

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
| `/job ui` | Serve the read-only dashboard — `scripts/ui.py`; `--lan` also serves it, key-gated, to other devices on the network |
| `/job help` | `cat "$HOME/.claude/skills/job/help.txt"` and nothing else — no run, no queries, no commentary |

**If `$CAREER` does not exist, run setup first** — `/job` before setup is a no-op. Adding a mode
means adding it to the table above and to `help.txt`.

## Reference files

Every detail lives one level down, read when the phase that needs it starts.

| File | Read before |
| ---- | ----------- |
| `references/setup.md` | First run — building `$CAREER`, the profile interview, tuning the watchlist |
| `references/fetching.md` | Phase 1 — adding a company, the Indeed harvest, manual boards |
| `references/ingesting.md` | Phase 1 — the filter chain, source precedence, dedupe, tuning |
| `references/resume.md` | Phase 3 — everything about building one: rules, checks, spec, build |
| `references/applying.md` | Phases 4–5 — reaching each ATS's form, filling it, the traps, submitting |

**The code is the manual for anything it already decides**, so nothing above restates it:

```bash
$Q --schema                     # every table, view, CHECK and trigger
ingest.py --filters | --help    # the filter chain, in order, and every flag
fetch.py sources                # each source's kind, rank, endpoint and quirk
render.py --spec                # the resume spec, and every section type
```

## Storage

One convention: `$CAREER/job.db` — postings, prospects, companies, filters, staged applications,
history, and the user's whole profile are rows in it.

**`$CAREER` is a fixed absolute directory, so `/job` runs identically from anywhere.** Ask the skill
where it is rather than resolving against the working directory:

```bash
CAREER=$(python3 "$HOME/.claude/skills/job/scripts/jobkit.py" career)
```

`jobkit.py` also answers `db`, `resumes` and `submitted`. Default `~/data/job`; `JOB_CAREER_DIR`
overrides it. **Paths stored in the database are absolute** — a relative one breaks the next run
started somewhere else.

**Two layers, one direction.** `postings` is everything a fetch returned, unjudged. `prospects` is
what ingest kept, and the only table the later phases touch. Every posting carries a `disposition`
naming the filter that ruled on it, so "what did that filter cost me" is a query, and a changed
filter re-rules what is stored instead of going back to the network.

```bash
Q='python3 "$HOME/.claude/skills/job/scripts/q.py"'
$Q --schema                                        # the manual: tables, views, CHECKs, triggers
$Q "SELECT * FROM triage WHERE status='new'"
$Q --json "SELECT * FROM staged"
```

`$Q` is shorthand for that path throughout this skill and its references. Shell state does not
survive between tool calls, so keep the assignment on the same command line as the query.

**Read `--schema` before writing SQL** — it documents every table, and its `CHECK`s make an invalid
row impossible to write. Three behaviors it encodes and you must not fight:

- **Triggers write `events`** on insert and on every status change. Never insert there yourself,
  except to add a `note` the transition alone does not say.
- **Setting `score` sets `status`** against `shortlist_threshold`, so the two cannot disagree.
- **`triage` omits `description` on purpose.** Pull descriptions one at a time, for survivors only:
  `SELECT * FROM prospects` is almost always a mistake, and `SELECT * FROM postings` more so.

The filesystem holds only built PDFs: `$CAREER/resumes/`, moved to `submitted/` when an application
goes out.

**Point the user at the dashboard rather than reading rows aloud.** `/job ui` serves `127.0.0.1` on
the first free port from 8765 — every job opening on its full application with each drafted essay and
flagged field, the whole profile with its `NULL`s called out, and the watchlist. It is **read-only,
enforced by SQLite** (`mode=ro`), because the invariants that make a write safe live here, not in a
web page. Its one action is a **Run** button, which opens the platform's terminal on `claude "/job"`,
so the phases that need a person still get one.

**Never write run notes or daily summaries to disk.** The database is the record, and a question
about the search — what went quiet, which companies reject fastest — is **answered with a query**, in
the conversation.

**The user never opens a file and never writes SQL.** Their career history, a corrected fact, a
changed goal: they talk, you write rows. Read before writing — you are merging, not replacing — and
ask about anything genuinely ambiguous: dates, whether work was solo, whether a number was measured
or estimated, since an invented number here becomes a lie on a resume. **Never invent experience**; a
project belongs in `projects` only if the user said it happened. **Add to `search_notes` and `facts`,
never rewrite them** — they carry judgement that took real conversation to establish. A row that does
not exist means "none", not "never asked". `$Q --export` hands them the whole thing as portable SQL.

## Phase 1 — Fetch, then ingest

Two steps, and they stay separate. Fetching judges nothing; ingest fetches nothing. Both are free to
re-run, and every source normalizes into the same columns, so one filter chain rules on all of them.

```bash
S="$HOME/.claude/skills/job/scripts"
python3 "$S/fetch.py" boards                                  # every watched board, in parallel
python3 "$S/fetch.py" harvest --source indeed --file <harvest.json>
python3 "$S/ingest.py"                                        # postings -> prospects
python3 "$S/ingest.py" --redo --no-location-filter            # re-rule stored rows, no network
```

Flags and filters are `--help` and `--filters` away; do not guess them.

The Indeed harvest is the one source a browser has to collect. **Read `references/fetching.md`
before running it.** Its descriptions arrive after ingest, for kept rows only:
`fetch.py descriptions --file <descs.json>`.

Companies on Workday, iCIMS and the like are rows with `ats='manual'` and a cadence; `manual_boards`
lists what is due. Check those, `INSERT` finds into `prospects` directly, and set `last_checked`.
When a find resolves to a supported ATS, `INSERT` it into `companies` — found by hand once, fetched
every morning after.

## Phase 2 — Score

```bash
$Q "SELECT * FROM triage WHERE status='new'"                         # no descriptions, on purpose
$Q "SELECT key, description FROM prospects WHERE key IN ('…','…')"   # only what survives triage
$Q "UPDATE prospects SET score=9, reason='the JD language that drove it, quoted' WHERE key='…'"
```

Triage against `search_criteria` (the rubric) and `search_notes` (the judgement the schema cannot
hold), pull descriptions for the plausible ones, then score, citing the JD language that drove it.

**Anything you score must have had its description read** — scoring off a title is the failure this
phase exists to prevent; a "Software Engineer" JD that is 80% LLM work beats a "Senior AI Engineer"
req that is really data plumbing. **Apply dealbreakers first**, a hard zero regardless of how well the
rest reads. **Score every prospect, including the ones you skip** — an unscored row stays `new` and
comes back tomorrow. Where a score turns on something still `NULL`, score on a stated assumption and
say so in `reason`.

## Phase 3 — Resume

For each shortlisted role, build a tailored one-page PDF. **Read `references/resume.md`** — the
selection method, the writing rules, the one-pass test, the spec, and the build. **Read the rendered
page before moving on**; a resume that never got looked at is not ready to attach. Then
`UPDATE prospects SET resume='<absolute path to the pdf>'`.

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

Present every staged application in one table — company, title, score, status, and whatever is named
in `blocked_on` (`SELECT * FROM staged`). Keep it to that table; the user reads the applications
themselves in the dashboard. Then ask which to submit, accepting "all", a subset, or none.

For each approved one: click submit, wait for the confirmation page, and **verify it**. A validation
error means nothing was submitted — repair the named field and re-present it. Then:

```bash
$Q "UPDATE prospects SET status='applied', resume='$CAREER/resumes/submitted/<slug>.pdf' WHERE key='…'"
```

and move that resume's `.pdf` and `.json` into `$CAREER/resumes/submitted/`. The status change and the
file move go together.

## Recording a rejection

Only a reported rejection. Do nothing for a role that is merely quiet.

```bash
$Q "UPDATE prospects SET status='rejected', resume=NULL WHERE key='…';
    INSERT INTO events(key,status,note) VALUES('…','rejected','3 days, no interview — resume screen')"
```

Then **delete that resume's `.pdf` and `.json` from `$CAREER/resumes/submitted/`** — the record still
says an application went out, and the dead document is gone. **A synced folder can re-materialize a
deleted file**: re-list the directory and delete again if it reappeared. Note the shape where it is
visible — days from submission, and whether any interview stage happened.
