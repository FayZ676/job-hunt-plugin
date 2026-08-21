# Scanning and scoring

Phases 1–2 of `/job` in detail: fetching the boards, working the manual list, scoring against the
profile, and keeping the ledger honest.

## Fetch

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py"
```

Stdlib only, no install step. It hits every active board in parallel, applies the mechanical filters
(title regex, location, posting age), drops any `key` already in the ledger, and writes
`career/jobs/<date>-candidates.json`.

| Flag | Use |
| ---- | --- |
| `--company Anthropic` | scan one board, repeatable, for testing a newly added slug |
| `--include-seen` | ignore the ledger, for rebuilding a run entry |
| `--no-location-filter` | see what the location rule is costing |
| `--max-age-days 7` | tighten to the last week |
| `--force` | overwrite an existing candidates file |

`<date>-candidates.json` holds the full JD text that phases 3–4 read, so the script **refuses to
overwrite** a same-day file with a smaller result. A second plain run after the ledger is written
would otherwise wipe the day's descriptions. Rebuild a day with `--include-seen --force`.

Multi-location postings for one role merge into a single candidate, with the extra ids in
`duplicate_keys`. **Log every one of those ids to the ledger**, or the siblings return as new
tomorrow. This also means the ledger holds more lines than jobs — count unique roles, not lines.

**Read the failure list.** A failing board usually means the company moved ATS or the slug is wrong.
Fix `career/scan-config.json` or set `"active": false`. Do not leave it failing every morning.

## Indeed

The second source, and the only one that finds companies nobody put on a list. It is a browser pass
with its own reference — **read `references/indeed.md` before running it**, because the one mechanism
detail it turns on is easy to get backwards.

The short version: **navigate** to each search URL rather than fetching it, harvest the results out of
`window.mosaic` into `localStorage`, save to disk with a blob download, filter with `indeed_filter.py`,
fetch descriptions only for what survives, then `merge` into the day's candidates file. Roles at
companies already in `career/scan-config.json` are dropped on the way through — the watchlist has the
same posting with a better description.

Navigation is not rate-limited, so there is no query budget to ration. Using `fetch()` instead is what
produces the 429s, and it is the only common way to break this pass.

When an Indeed find resolves to Greenhouse, Lever, or Ashby, **add the company to
`career/scan-config.json`**. That is the point of the pass: each company it turns up is found by hand
once and scanned automatically every morning after.

## Manual boards

`references/manual-boards.md` lists companies `scan.py` cannot reach — Workday, iCIMS, and similar.
It skews local and regulated-industry, which is exactly where the automated watchlist is thinnest,
so skipping it permanently biases the search.

**Indeed overlaps this list but does not replace it** — it reaches some of these employers and not
others, and it is the least reliable source in the skill. Use the coverage rule in
`references/manual-boards.md` to decide, per company, whether a cadence check is still earning its
keep.

Each entry carries a cadence. **Check the file, do only what is due, and record in the run entry
which ones were checked and which were not due.** If nothing is due, say that. Manual finds use a
`manual:` key prefix and go in the ledger like any other candidate.

Do not let this balloon the run. When several fall due together, do the weeklies and the highest-value
monthlies, and note the rest as deferred.

## Score

Read `career/search-profile.md` in full, then `career/jobs/<date>-candidates.json`. Score each
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

`career/applications.jsonl`, one JSON object per line, append-only. **One line per candidate, every
candidate.** Skipped jobs must be logged or tomorrow's run resurfaces them.

```json
{"key":"greenhouse:anthropic:4012345","company":"Anthropic","title":"Senior AI Engineer, Applied","url":"https://…","location":"Remote (US)","posted_at":"2026-08-02T00:00:00+00:00","first_seen":"2026-08-06","score":9,"reason":"JD leads with production LLM evaluation harnesses","status":"queued"}
```

`status` vocabulary: `queued` (shortlisted, resume not yet built) · `skipped` (scored, not pursuing) ·
`staged` (form filled, awaiting approval) · `applied` · `rejected` · `closed` · `interviewing`.

Status changes append a **new line with the same `key`** — last line wins. Never rewrite or delete
earlier lines; the file is the history. Append with a heredoc or a small Python snippet so a partial
failure cannot truncate it.

## Reconcile resumes against the ledger

A resume in `career/resumes/` with no matching ledger line means an application fell out of the
pipeline. Worth catching every run — it happened on 2026-08-10, when a Precision Castparts resume had
sat unlogged since 2026-08-06.

```bash
python3 - <<'PY'
import json, pathlib, re
led = [json.loads(l) for l in open('career/applications.jsonl')]
blob = " ".join(f"{o['company']} {o['title']} {o.get('resume','')}".lower() for o in led)
for p in sorted(pathlib.Path('career/resumes').rglob('*.pdf')):
    stem = p.stem.lower()
    company = re.split(r'-(senior|staff|ai|ml|software|lead)', stem)[0].replace('-', ' ')
    if company not in blob and stem not in blob:
        print("UNTRACKED:", p)
PY
```

Anything printed needs a ledger line before the run finishes. Ask the user whether it was submitted —
`applied` against `queued` is his call, never an assumption — and record the resume path and build
date. If the company is unreachable by `scan.py`, add it to `references/manual-boards.md` too.

## Tuning the filters

The scan prints how many postings each filter dropped. Use those counts rather than guessing.

| Symptom | Fix |
| ------- | --- |
| Obvious junk in candidates | `title_exclude` in `career/scan-config.json` |
| A real role got filtered out | `title_include`, or loosen `location_include` |
| Candidates fine, scores wrong | `career/search-profile.md` |
| Same company never has anything | `"active": false` |
| Too few candidates | check the location counter; it is usually location |

## Adding companies

Find the ATS slug from the careers page URL — `boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`,
`jobs.ashbyhq.com/<slug>` — add an entry to `companies`, then verify:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/scan.py" --company "<Name>" --include-seen
```

A slug that 404s is wrong, or the company is on an ATS this script does not support (Workday, Taleo,
iCIMS, SmartRecruiters). See `references/ats-apis.md`.

## The run entry

`career/jobs/<date>.md` is this skill's log — one note per day, covering the whole run through to
submission, sitting alongside its `<date>-candidates.json`. **Keep the folder flat** so the series
reads as a run of daily notes; do not introduce per-date subfolders.

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
