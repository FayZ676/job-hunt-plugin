# Scoring and the record

Judging a candidate, and the three places the judgement gets written down.

## Score

Read `career/search-profile.md` in full, then `career/.state/scans/<date>.json`. Score each
candidate 0–10 by the rubric in the profile.

- **Read the `description` field.** Scoring off the title alone is the failure this step exists to
  prevent. A "Software Engineer" JD that is 80% LLM work beats a "Senior AI Engineer" req that is
  really data plumbing.
- **Every score cites the specific JD language that drove it**, quoted or named.
- Apply dealbreakers first. A dealbreaker is a hard zero regardless of how well the rest reads.
- Check the profile's TODO block. Where a score genuinely turns on an unfilled item, score on the
  stated assumption and mark the role assumption-dependent in the run entry.

With many candidates, triage on title and company first, then read descriptions in full only for the
plausible ones. Do not burn the context reading 200 JDs end to end.

## The ledger

`career/.state/applications.jsonl`, one JSON object per line, append-only. **One line per candidate, every
candidate.** Skipped jobs must be logged or tomorrow's run resurfaces them.

```json
{"key":"greenhouse:anthropic:4012345","company":"Anthropic","title":"Senior AI Engineer, Applied","url":"https://…","location":"Remote (US)","posted_at":"2026-08-02T00:00:00+00:00","first_seen":"2026-08-06","score":9,"reason":"JD leads with production LLM evaluation harnesses","status":"queued"}
```

`status` vocabulary, roughly in lifecycle order: `queued` (shortlisted, resume not yet built) ·
`surfaced` (seen and worth a look, not yet scored) · `skipped` (scored, not pursuing) ·
`staged` (form filled, awaiting approval) · `applied` · `interviewing` · `rejected` ·
`not_pursued` (shortlisted then dropped, with a reason) · `closed` (posting taken down).

Status changes append a **new line with the same `key`** — last line wins. Never rewrite or delete
earlier lines; the file is the history.

**Write it with `ledger.py`, never by hand.** A malformed line is not a crash — it is a posting that
silently resurfaces, or an application recorded as never sent.

```bash
L='python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/ledger.py"'
$L append --key greenhouse:anthropic:401 --company Anthropic --title "Senior AI Engineer" \
   --url https://… --location "Remote (US)" --posted_at 2026-08-02 --score 9 --reason "…" --status queued
$L status greenhouse:anthropic:401 --status applied --resume career/resumes/anthropic-senior-ai-engineer.pdf
$L get greenhouse:anthropic:401     # latest state
$L keys                             # every key ever seen, for dedupe
$L stats                            # counts by status
```

`append` records a newly seen posting; `status` carries the role's latest state forward with a new
status and a timestamp, so the previous lines stay intact as history.

## Reconcile resumes against the ledger

A resume in `career/resumes/` with no matching ledger line means an application fell out of the
pipeline. Worth catching every run.

```bash
python3 - <<'PY'
import json, pathlib, re
led = [json.loads(l) for l in open('career/.state/applications.jsonl')]
blob = " ".join(f"{o['company']} {o['title']} {o.get('resume','')}".lower() for o in led)
for p in sorted(pathlib.Path('career/resumes').rglob('*.pdf')):
    stem = p.stem.lower()
    company = re.split(r'-(senior|staff|ai|ml|software|lead)', stem)[0].replace('-', ' ')
    if company not in blob and stem not in blob:
        print("UNTRACKED:", p)
PY
```

Anything printed needs a ledger line before the run finishes. Ask the user whether it was submitted —
`applied` against `queued` is their call, never an assumption — and record the resume path and build
date. If the company is unreachable by `scan.py`, add it to `references/manual-boards.md` too.

## The run entry

`career/runs/<date>.md` is this skill's log — one note per day, covering the whole run through to
submission, sitting alongside its `<date>.json`. **Keep the folder flat** so the series
reads as a run of daily notes; do not introduce per-date subfolders.

```markdown
# Job run — 2026-08-18

**Scanned:** 137 boards · 14,455 postings · 20 new after filters · 4 manual-board roles reviewed
**Indeed:** 16 queries · 148 cards · 123 dropped as noise or dupes · 24 new · 23 companies not on the watchlist
**Shortlisted:** 3 · **Logged and skipped:** 21
**Resumes built:** 3 · **Staged:** 3 · **Submitted:** 2 · **Waiting on you:** 1

One line on the shape of the day.

## Applications

### 1. Northwind Analytics — Machine Learning Engineer  ·  **9/10**  (manual board)
- **Location:** Remote — USA · **Posted:** 10 days ago · **Comp:** $138.3K–$232.5K by state band
- **Why:** the specific JD language that drove the score, quoted.
- **Gaps:** what the JD asks for that the file does not answer.
- **Link:** https://…
- **Resume:** `career/resumes/northwind-machine-learning-engineer.pdf`
- **Outcome:** submitted 2026-08-18 14:22, confirmation verified

### 2. Kestrel Labs — Software Engineer, Model Evaluation  ·  **8/10**
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
