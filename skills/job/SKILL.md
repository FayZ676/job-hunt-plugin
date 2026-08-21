---
name: job
description: The full daily job routine in one command — scan tracked boards for new openings, score them against the search profile, build a tailored resume for each shortlisted role, fill out its application form in the browser, and submit the ones the user approves. Use for "run the job routine", "scan and apply", "any new openings", "apply to these", or the morning job search. Sub-modes cover scanning, resume building, and applying on their own. `/job setup` creates the career files on first use.
---

# Job routine

One command carries a posting from "it exists on a board somewhere" to "the application is
submitted." Five phases, run in order:

**scan → score → resume → stage → submit**

**The deliverable is submitted applications and a ledger that records them.** A run that stages four
applications and submits none has not finished; it is waiting on the user.

Everything up to the submit click is unattended. The submit click is never unattended.

**Chat output is minimal by design.** The run entry (`career/jobs/<date>.md`) and the ledger are the
record of what happened — do not narrate progress, phase transitions, or summaries into chat. The
only things that belong in chat are: the approval prompt in Phase 5, and anything that blocks
progress and needs the user to supply or decide something (a missing answer-bank value, a login wall,
a form error that needs a human call). A run with nothing to ask about produces no chat output at
all; the user reads the run entry when they want to see what happened.

## Modes

| Invocation | Runs |
| ---------- | ---- |
| `/job setup` | First-run setup — creates `career/` from the templates and interviews the user |
| `/job` | All five phases |
| `/job scan` | Phases 1–2, ending at the review note |
| `/job scan --no-indeed` | Phases 1–2, watched boards only |
| `/job indeed` | The Indeed pass on its own, merged into the day's candidates |
| `/job resume <JD, URL, or ledger key>` | Phase 3 for one role |
| `/job apply <ledger key or URL>` | Phases 3–4 for one role, stopping before submit |
| `/job submit` | Phase 5 over whatever is already staged |

## Source files

| Purpose | Path |
| ------- | ---- |
| Companies and mechanical filters | `career/scan-config.json` |
| Companies checked by hand | `career/manual-boards.md` |
| Indeed queries and noise filters | `career/indeed-queries.json` |
| What is worth applying to | `career/search-profile.md` |
| Accomplishments, and the answer bank | `career/index.md` |
| Ledger of every posting ever seen | `career/applications.jsonl` |
| Run entry, one per day | `career/jobs/<date>.md` |
| Resumes, not yet submitted | `career/resumes/` |
| Resumes that went out with an application | `career/resumes/submitted/` |
| Staged applications | `career/staged/<date>-<slug>.json` |
| Scanning, scoring, the ledger | `references/scanning.md` |
| Form mechanics per ATS | `references/ats-forms.md` |
| ATS endpoint reference | `references/ats-apis.md` |
| Companies not on a supported ATS | `references/manual-boards.md` |
| The Indeed pass | `references/indeed.md` |
| Resume writing rules | `references/resume-writing.md` |
| Resume section order | `references/resume-template.md` |
| Resume spec format | `references/resume-spec-schema.md` |
| Recurring resume defects | `career/resume-patterns.md` |

**If `career/` does not exist, run setup first** — `/job` on an unconfigured directory is a no-op.

Paths under `career/` are relative to the project root — the directory you run Claude from.
Paths under `references/` and `scripts/` are inside this plugin.

---

## Phase 0 — Setup

Run this when `career/` is missing, or when the user asks for setup. It exists so a new user is
running real scans the same day they install the plugin.

**1. Copy the templates.** From the project root:

```bash
cp -R "${CLAUDE_PLUGIN_ROOT}/templates/career" ./career
```

That gives them `scan-config.json` (a starter watchlist of companies on Greenhouse, Lever, and
Ashby), `indeed-queries.json`, `search-profile.md`, `index.md`, `manual-boards.md`, an empty
`applications.jsonl`, and the `jobs/`, `resumes/`, and `staged/` directories.

**2. Interview the user, then fill the templates for them.** Do not hand back a wall of `TODO`s and
ask them to edit files — ask the questions in chat, and write the answers in. Ask about:

- **Identity and contact** — everything under `### Identity` in `career/index.md`.
- **Work authorization, availability, compensation floor** — the rest of the answer bank.
  Demographic self-identification is optional; `Decline to self-identify` is a complete answer, and
  offering that is better than pressing.
- **What they're looking for** — titles that fit, titles that don't, level, years of experience,
  hard dealbreakers. This becomes `career/search-profile.md`.
- **Where they'll work** — remote only, or a home metro. Their answer replaces the `YOUR_CITY`
  placeholders in `scan-config.json` and the locations in `indeed-queries.json`.
- **Their experience** — employers, dates, titles, and the projects underneath each. This is the
  longest part and it is the one that matters most: **`career/index.md` is the only thing a resume
  may be built from**, so a thin file produces thin resumes. Offer to read a résumé, CV, or LinkedIn
  export if they have one, and draft `career/index.md` from it for them to correct.

**3. Tune the watchlist.** The shipped `companies` list is AI- and ML-flavored, and so are the
`title_include` regexes. If the user is hiring into a different field, rewrite both — the watchlist
is a starting point, not a recommendation.

**4. Check the tooling.** Only the resume build needs anything installed:

```bash
node --version && npm ls -g docx >/dev/null 2>&1 || npm install -g docx
command -v soffice || echo "brew install --cask libreoffice"
```

Scanning and scoring work without either; the user can start there and install before the first
resume.

**5. Do a dry run.** `/job scan --no-indeed` and show them the review note. A first scan that returns
sensible companies is the signal that `scan-config.json` is tuned; one that returns nothing or
thousands means the filters need another pass, and the per-filter drop counts say which one.

**Setup is done when `career/index.md` has no `TODO` left in the answer bank.** A `TODO` there blocks
applications later, so it is cheaper to resolve it now.

## Phase 1 — Scan

Two sources feed one candidate list, in this order.

**A. The watched boards.** The companies in `career/scan-config.json`, on Greenhouse, Lever, and Ashby:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py"
```

Run it from the project root — the directory `career/` sits in.

Writes `career/jobs/<date>-candidates.json` with full JD text.

**B. Indeed.** Answers what the watchlist structurally cannot — who is hiring that isn't on it. This is
a browser pass, not a script: search from inside a loaded Indeed page, filter the results, then fetch
descriptions for the survivors only.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" filter --raw <raw.json>
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" merge --descriptions <descs.json>
```

`merge` folds Indeed's finds into the same `<date>-candidates.json`, so Phase 2 scores one list.

**Read `references/indeed.md` before running it.** The one rule that matters: **navigate to each search
URL, never `fetch()` it.** Navigation is not rate-limited — 40 page loads in a session returned 200
while `fetch` against the same URLs was returning 403. Harvest into `localStorage`, save to disk with a
blob download, and never read the raw harvest through the model.

Read `references/scanning.md` for flags, the manual-board cadence, filter tuning, and the
ledger-reconciliation step.

## Phase 2 — Score

Read `career/search-profile.md` in full, then score each candidate 0–10 by its rubric. Every score
cites the specific JD language that drove it. Dealbreakers are a hard zero.

Append one ledger line per candidate, shortlisted or not. `references/scanning.md` holds the schema.

Then open the run entry. **`career/jobs/<date>.md` is this skill's log** — one note per day,
covering the whole run through to submission, sitting alongside its `<date>-candidates.json`. Keep
the folder flat so the series reads as a run of daily notes; do not introduce per-date
subfolders.

Write it at the end of phase 2 with the scan counts and shortlist, then **update it in place** as
phases 3–5 complete. A run that ends without the entry reflecting what actually happened has not
finished.

**Shortlist threshold for an automatic run: 7 or above.** Below that, list it in the review note and
leave it at `skipped`. The user can promote one by hand.

There is no daily cap and no per-company cap. Shortlist every role that scores 7 or above. Where
`career/index.md` records a stated per-company limit, note in the run entry that an application went
out past it — but do not hold the application back.

### The run entry

```markdown
# Job run — 2026-08-18

**Scanned:** 137 boards · 14,455 postings · 20 new after filters · 4 manual-board roles reviewed
**Indeed:** 16 queries · 148 cards · 123 dropped as noise or dupes · 24 new · 23 companies not on the watchlist
**Shortlisted:** 3 · **Logged and skipped:** 21
**Resumes built:** 3 · **Staged:** 3 · **Submitted:** 2 · **Waiting on you:** 1

One line on the shape of the day.

## Applications

### 1. Zillow — Machine Learning Engineer, Agentic AI  ·  **9/10**  (manual board)
- **Location:** Remote — USA · **Posted:** 10 days ago · **Comp:** $138.3K–$232.5K by state band
- **Why:** the specific JD language that drove the score, quoted.
- **Gaps:** what the JD asks for that the file does not answer.
- **Link:** https://…
- **Resume:** `career/resumes/zillow-machine-learning-engineer-agentic-ai.pdf`
- **Outcome:** submitted 2026-08-18 14:22, confirmation verified

### 2. Deepgram — Senior Software Engineer, Model Evaluation  ·  **8/10**
- …
- **Outcome:** staged, waiting on review of the "most impressive thing built with AI" essay

## Also new, not shortlisted

| Company | Title | Score | Why not |
|---|---|---|---|

## Manual boards

Checked: … · Not due: … · Deferred: …

## Boards that failed
```

`Outcome` is the line that makes this a run entry: `submitted <timestamp>, confirmation verified` ·
`staged, waiting on <what>` · `blocked on <missing answer>` · `not pursued — <reason>`. Every
shortlisted role carries one by the end of the run.

This file is rendered markdown. Keep links bare or as markdown links, and keep the applications section
at the top where it reads without scrolling.

## Phase 3 — Resume

For each shortlisted role, build a tailored resume. `references/resume-writing.md` carries the
selection method, the writing rules, the one-pass test, and the facts that must never be
misreported. Follow it exactly; it is the difference between a resume that reads once and one that
gets skimmed past.

```bash
export NODE_PATH=$(npm root -g)
node "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/build.js" career/resumes/<slug>.json career/resumes/<slug>.docx --density tight
bash "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/topdf.sh" career/resumes/<slug>.docx
pdftoppm -jpeg -r 95 career/resumes/<slug>.pdf /tmp/page
```

**Read the rendered image before moving on.** A resume that never got looked at is not ready to
attach to an application.

Update the role's ledger line with the resume path.

## Phase 4 — Stage the application

This phase fills the form completely and stops with a finger over the button.

Read `references/ats-forms.md` first — it covers locating the apply form per ATS, the field patterns,
typeaheads, file upload, and the traps.

### The three tiers

Every field on every application form is one of these. The tier decides who answers it.

| Tier | What it is | Source | Filled automatically |
| ---- | ---------- | ------ | -------------------- |
| **Identity** | Name, email, phone, location, LinkedIn, GitHub, resume upload | `## Application answers` in `career/index.md` | Yes |
| **Policy** | Work authorization, sponsorship, start date, compensation, EEO self-identification | Same section | Yes |
| **Judgment** | Role-specific screening questions, essays, "why this company", anything conditional on the posting | Nothing — no stored answer exists | No. Drafted and flagged |

### Rules

**A `TODO` in the answer bank is a hard stop.** Leave the field empty, mark the staged record
`blocked`, and name the missing value in the report. Never infer a phone number, a salary, or a
demographic answer.

**Never answer a judgment question by inference.** A screening question about hours, travel, on-site
days, or clearance gets the answer the bank supports, and when the bank does not support one, it gets
flagged for the user. An honest answer that ends an application is the correct answer.

**A screening question with direct evidence in `career/index.md` is answerable.** When a form asks
whether the user has built a particular kind of system and a project in `career/index.md` plainly
shows they have, that is a Yes, and the staged record cites the project as the evidence. Answer
these, record the evidence alongside the value, and
flag them `evidence-backed` so the review can check the reasoning. A question whose answer needs a
project that is not in the file is not evidence-backed — it is a flag.

**Essays are drafted, never auto-accepted.** Draft from `career/index.md` under the writing rules in
`references/resume-writing.md` — real projects, real numbers, one idea per sentence. Mark every essay
`needs-review` regardless of how well it reads.

**Answer to the truth, including when it costs the application.** A commitment recorded in the
answer bank — earliest start time, notice period, travel tolerance — is a ceiling, not an opening
position.

### Output

Fill every field the tiers allow, attach the resume PDF, then **stop before the submit control**.
Screenshot the completed form. Write `career/staged/<date>-<slug>.json`:

```json
{
  "key": "ashby:cohere:3fe03041",
  "company": "Cohere",
  "title": "Applied AI Engineer, Agents & Automations",
  "url": "https://jobs.ashbyhq.com/cohere/…/application",
  "ats": "ashby",
  "resume": "career/resumes/cohere-applied-ai-engineer.pdf",
  "screenshot": "career/staged/2026-08-18-cohere.png",
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
`submitted` · `abandoned`.

Keep the browser tab open. Staging survives a lost session through this file, and refilling from it
is cheap.

## Phase 5 — Review and submit

Present all staged applications in one table: company, title, score, status, and any field flagged
`needs-review` or `blocked`. Show every drafted essay in full — an essay the user has not read is an
essay they did not write. This table and its essays are the approval prompt, not a status report —
keep everything else (scan counts, phase narration, boards checked) out of it; that belongs in the
run entry file, not chat.

Then ask which to submit. Accept "all", a subset, or none.

**Submit only what the user names.** Silence is not approval. A staged application left unapproved stays
staged; it is never submitted on a later run without being asked again.

For each approved application: click submit, wait for the confirmation page, and **verify it**. A
form that returns a validation error was not submitted — repair the named field and re-present it.

Then append a ledger line with `"status":"applied"`, the submission timestamp, and the resume path;
**move the resume's `.pdf`, `.docx` and `.json` into `career/resumes/submitted/` and record the new
path on that ledger line**; mark the staged file `submitted`; and set that role's `Outcome` line in
the run entry. All three
records move together, so a run interrupted between them is visibly incomplete rather than silently
wrong.

**Only a verified confirmation justifies `applied`.** Clicking the button is not evidence.

## Recording a rejection

When the user reports a rejection, three things happen together:

1. **Append a ledger line** carrying the role's latest state with `"status":"rejected"` and
   `"rejected_at"`. Note the shape when it is visible — days from submission, and whether any
   interview stage happened. A rejection three days out with no interview is a resume screen, and
   that is worth knowing across roles.
2. **Delete the resume's `.pdf`, `.docx` and `.json` from `career/resumes/submitted/`**. A closed application's resume is dead weight; `submitted/` should hold only documents
   attached to applications still in play. Record the removed path on the ledger line as
   `resume_deleted` and set `resume` to `null`, so the ledger still says which document went out even
   though the file is gone.
3. **Set the role's `Outcome` line** in its run entry to `rejected <date>`, leaving the original
   submission line intact.

Do not delete anything for a role that is merely quiet. Only a reported rejection triggers this.

**A synced folder can re-materialize a deleted file.** When `career/` lives in iCloud Drive,
Dropbox, or similar, a file deleted in one step has come back minutes later. After deleting,
re-list the directory and delete again if it reappeared.

## Phase 6 — Report

No chat output if nothing needs the user: submissions went through clean, nothing is blocked, no
essays are waiting on review. The run entry file already has the counts and outcomes; repeating them
in chat is noise.

If something needs the user — a blocked field, an unanswered screening question, an essay still
`needs-review`, a failed board worth knowing about — say only that, in as few lines as it takes to
name what's needed and where (which role, which field, which file). Do not restate what already
went cleanly alongside it.

## Failure modes

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Form fields do not appear in the snapshot | Form renders after page load | Wait for the loading text to clear, then re-snapshot |
| A staged run has every application `blocked` | Answer bank still has `TODO`s | Fill them in `career/index.md` once; every future run benefits |
| Same posting staged twice | Ledger line never written | Phase 2 writes the ledger before Phase 4 runs |
| Zero candidates from thousands of postings | Filters too tight | Read the per-filter drop counts; it is usually location |
| Login wall on the apply form | Company requires an account | Stage what is reachable, flag the rest for the user to do by hand |
| Indeed returns 429 or 403 | The pass used `fetch()` instead of navigating | Navigate to each URL. Navigation is not throttled; XHR is |
| Indeed re-proposes a watchlist role | Company name spelled differently in `scan-config.json` | Reconcile the spelling so the dedupe matches |

## What this skill will not do

- Submit without approval for that specific application, in that run.
- Write an answer that is not true, or that `career/index.md` does not support.
- Accept a drafted essay on the user's behalf.
- Record `applied` without a verified confirmation.
