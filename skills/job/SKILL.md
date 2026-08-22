---
name: job
description: The full daily job routine in one command — scan tracked boards for new openings, score them against the search profile, build a tailored resume for each shortlisted role, fill out its application form in the browser, and submit the ones the user approves. Use for "run the job routine", "scan and apply", "any new openings", "apply to these", or the morning job search. Sub-modes cover scanning, resume building, and applying on their own. `/job setup` creates the career files on first use.
---

# Job routine

Carries a posting from "it exists on a board somewhere" to "the application is submitted."

**scan → score → resume → stage → submit**

**The deliverable is submitted applications and a ledger that records them.** A run that stages four
and submits none has not finished; it is waiting on the user.

## Invariants

These hold in every phase. Nothing below overrides them.

1. **Everything up to the submit click is unattended. The submit click never is.** Submit only what
   the user names, in that run. Silence is not approval, and an unapproved application stays staged
   rather than going out on a later run.
2. **Never write an answer `career/index.md` does not support.** A `TODO` is a hard stop: leave the
   field empty and report it. Never infer a phone number, a salary, or a demographic answer.
3. **Answer to the truth, including when it costs the application.** A commitment in the answer bank
   is a ceiling, not an opening position.
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
| `/job resume <JD, URL, or ledger key>` | Phase 3 for one role |
| `/job apply <ledger key or URL>` | Phases 3–4 for one role, stopping before submit |
| `/job submit` | Phase 5 over whatever is already staged |

**If `career/` does not exist, run setup first** — `/job` on an unconfigured directory is a no-op.

## Files

`career/` is split by who owns what, relative to the project root you run Claude from.

**The user edits these.** Never rewrite one without being asked.

| Path | What |
| ---- | ---- |
| `career/watchlist.toml` | Watched companies and mechanical filters |
| `career/indeed.toml` | Indeed queries and noise filters |
| `career/search-profile.md` | What is worth applying to |
| `career/index.md` | Accomplishments, and the answer bank |
| `career/manual-boards.md` | Companies checked by hand, on a cadence |
| `career/resume-patterns.md` | Recurring resume defects |

**The user reads these.** Written by this skill, for them.

| Path | What |
| ---- | ---- |
| `career/runs/<date>.md` | Run entry, one per day |
| `career/resumes/` → `submitted/` | Resumes, before and after they go out |

**The system owns these.** `.state/` is dot-prefixed so vault tools ignore it; do not surface
these paths to the user as things to open.

| Path | What |
| ---- | ---- |
| `career/.state/applications.jsonl` | Ledger of every posting ever seen |
| `career/.state/scans/<date>.json` | The day's candidates, without descriptions |
| `career/.state/scans/<date>-jd.json` | Descriptions, keyed — read one at a time |
| `career/.state/staged/<date>-<slug>.json` | Staged applications |

Reference material, inside this plugin:

| Path | Read it for |
| ---- | ----------- |
| `references/setup.md` | First-run setup |
| `references/boards.md` | The API scan: flags, filter tuning, adding companies, endpoints |
| `references/indeed.md` | The Indeed pass |
| `references/manual-boards.md` | Boards no API reaches |
| `references/scoring.md` | Scoring, the ledger CLI and schema, the run entry |
| `references/applying.md` | Form mechanics and traps per ATS |
| `references/resume.md` | Writing rules, section order, spec format |

## Phase 1 — Scan

Two sources feed one candidate list.

**A. The watched boards.** Run from the project root:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py"
```

Writes two files: `career/.state/scans/<date>.json`, the candidate index, and
`career/.state/scans/<date>-jd.json`, the descriptions keyed by candidate.

**B. Indeed.** Answers what the watchlist structurally cannot — who is hiring that isn't on it. A
browser pass, not a script: search from inside a loaded Indeed page, filter, then fetch descriptions
for survivors only.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" filter --raw <raw.json>
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" merge --descriptions <descs.json>
```

`merge` folds the finds into the same `<date>.json`, so Phase 2 scores one list.

**Read `references/indeed.md` first.** The rule that matters: **navigate to each search URL, never
`fetch()` it** — navigation is not rate-limited, XHR is throttled to 403.

Read `references/boards.md` for flags, filter tuning, and adding companies;
`references/manual-boards.md` for the by-hand cadence.

## Phase 2 — Score

Read `career/search-profile.md` in full, then the day's index — `career/.state/scans/<date>.json`,
which carries title, company, location, compensation and age but **no descriptions**.

**Triage on the index first, then read descriptions only for the plausible ones.** Descriptions
live in `<date>-jd.json` keyed by candidate; pull the handful you need with a `python3 -c` one-liner
or `jq`, never by loading the whole file. A day's descriptions run to tens of thousands of tokens
and most of them belong to roles the index already ruled out.

Score each candidate you read 0–10 by the profile's rubric. Every score cites the specific JD
language that drove it. Dealbreakers are a hard zero. A score given without reading that role's
description is a title-match, which is the failure this phase exists to prevent.

Append one ledger line per candidate, shortlisted or not, with
`python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/ledger.py" append`. Never hand-write the file.

**Shortlist threshold: 7 or above.** Below that, log it `skipped`; the user can promote one by hand.
No daily cap and no per-company cap — where `career/index.md` records a per-company limit, note in
the run entry that an application went past it, but do not hold the application back.

Then write `career/runs/<date>.md` with the scan counts and shortlist, and **update it in place** as
phases 3–5 complete. Every shortlisted role carries an `Outcome` line by the end of the run:
`submitted <timestamp>, confirmation verified` · `staged, waiting on <what>` · `blocked on <missing
answer>` · `not pursued — <reason>`. A run that ends without the entry reflecting what happened has
not finished. `references/scoring.md` holds the ledger schema and the run-entry format.

## Phase 3 — Resume

For each shortlisted role, build a tailored resume. `references/resume.md` carries the
selection method, the writing rules, the one-pass test, and the facts that must never be misreported.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/render.py" career/resumes/<slug>.json career/resumes/<slug>.pdf --density tight
pdftoppm -jpeg -r 95 career/resumes/<slug>.pdf /tmp/page
```

**Read the rendered image before moving on.** A resume that never got looked at is not ready to
attach. Record the resume path on the role's ledger line.

## Phase 4 — Stage

Fill the form completely and stop with a finger over the button. Read `references/applying.md`
first — locating the apply form per ATS, field patterns, typeaheads, file upload, and the traps.

Every field is one of three tiers, and the tier decides who answers it:

| Tier | What it is | Source | Auto-filled |
| ---- | ---------- | ------ | ----------- |
| **Identity** | Name, email, phone, location, LinkedIn, GitHub, resume upload | `## Application answers` in `career/index.md` | Yes |
| **Policy** | Work authorization, sponsorship, start date, compensation, EEO | Same section | Yes |
| **Judgment** | Screening questions, essays, "why this company", anything conditional on the posting | Nothing stored | No — drafted and flagged |

A judgment question gets the answer the bank supports. Where the bank does not support one, it is
flagged for the user, **except** when a project in `career/index.md` plainly answers it — then
answer, cite that project as the evidence, and flag `evidence-backed` so the review can check the
reasoning. A question needing a project not in the file is a flag, not an inference.

Attach the resume PDF, screenshot the completed form, and write
`career/.state/staged/<date>-<slug>.json`:

```json
{
  "key": "ashby:cohere:3fe03041",
  "company": "Cohere",
  "title": "Applied AI Engineer, Agents & Automations",
  "url": "https://jobs.ashbyhq.com/cohere/…/application",
  "ats": "ashby",
  "resume": "career/resumes/cohere-applied-ai-engineer.pdf",
  "screenshot": "career/.state/staged/2026-08-18-cohere.png",
  "status": "ready",
  "fields": [
    {"label": "Name", "value": "Ada Lovelace", "tier": "identity"},
    {"label": "Do you have the legal right to work without visa sponsorship?", "value": "Yes", "tier": "policy"},
    {"label": "Tell us about an AI-powered product you built…", "value": "…", "tier": "judgment", "flag": "needs-review"}
  ],
  "blocked_on": []
}
```

`status`: `ready` (every field filled) · `blocked` (a `TODO` or an unanswerable question) ·
`submitted` · `abandoned`. Keep the browser tab open; staging survives a lost session through this
file, and refilling from it is cheap.

## Phase 5 — Review and submit

Present all staged applications in one table: company, title, score, status, and any field flagged
`needs-review` or `blocked`. **Show every drafted essay in full** — an essay the user has not read is
an essay they did not write. This table and its essays *are* the approval prompt; keep scan counts
and phase narration out of it.

Then ask which to submit, accepting "all", a subset, or none.

For each approved application: click submit, wait for the confirmation page, and **verify it**. A
validation error means it was not submitted — repair the named field and re-present it.

Then, together: record the status with `ledger.py status <key> --status applied --resume <path>`;
**move the resume's `.pdf` and `.json` into `career/resumes/submitted/`** and record the new
path on that line; mark the staged file `submitted`; set the role's `Outcome` in the run entry. All
four move together, so a run interrupted between them is visibly incomplete rather than silently
wrong.

## Phase 6 — Report

Nothing needed from the user means no chat output. Otherwise say only what is needed and where —
which role, which field, which file — without restating what went cleanly alongside it.

## Recording a rejection

When the user reports one, three things happen together:

1. **Record it** with `ledger.py status <key> --status rejected --resume-deleted <path>`. Note the shape when
   visible — days from submission, and whether any interview stage happened. A rejection three days
   out with no interview is a resume screen, and that is worth knowing across roles.
2. **Delete the resume's `.pdf` and `.json` from `career/resumes/submitted/`.** Record the
   removed path as `resume_deleted` and set `resume` to `null`, so the ledger still says which
   document went out. **A synced folder can re-materialize a deleted file** — re-list the directory
   after deleting and delete again if it reappeared.
3. **Set the role's `Outcome`** in its run entry to `rejected <date>`, leaving the submission line.

Only a reported rejection triggers this. Do nothing for a role that is merely quiet.

## Failure modes

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Form fields missing from the snapshot | Form renders after page load | Wait for the loading text to clear, re-snapshot |
| Every staged application `blocked` | Answer bank still has `TODO`s | Fill them in `career/index.md` once |
| Same posting staged twice | Ledger line never written | Phase 2 writes the ledger before Phase 4 runs |
| Zero candidates from thousands of postings | Filters too tight | Read the per-filter drop counts; usually location |
| Login wall on the apply form | Company requires an account | Stage what is reachable, flag the rest |
| Indeed returns 429 or 403 | The pass used `fetch()` | Navigate to each URL instead |
| Indeed re-proposes a watchlist role | Company spelled differently in `watchlist.toml` | Reconcile the spelling so dedupe matches |
