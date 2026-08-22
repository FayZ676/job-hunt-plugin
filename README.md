# job-hunt

A Claude Code plugin that runs a job search end to end: it scans company job boards for new
openings, scores each one against a profile you write, builds a tailored resume for the ones worth
applying to, fills out the application form in the browser, and submits only what you approve.

One command does the whole thing:

```
/job
```

## What it actually does

Five phases, in order.

| Phase | What happens |
|---|---|
| **Scan** | Hits the Greenhouse, Lever, and Ashby APIs for every company on your watchlist, plus an Indeed pass for employers who aren't on it. Ships with a 137-company starter watchlist. |
| **Score** | Reads your `search-profile.md` and scores each opening 0–10, citing the JD language that drove the score. Everything gets logged, shortlisted or not, so nothing is reviewed twice. |
| **Resume** | Builds a role-specific resume from your career file — DOCX, then PDF — selecting the bullets that match this posting. It never invents a number that isn't in your file. |
| **Stage** | Opens the application form and fills every field it has a stored answer for. Screening questions and essays get drafted and flagged, never auto-accepted. Stops with a finger over the submit button. |
| **Submit** | Shows you everything staged, with every drafted essay in full, and asks which to send. Submits only what you name, then verifies the confirmation page. |

**The submit click is never unattended.** Everything before it is.

## Install

```
/plugin marketplace add FayZ676/job-hunt-plugin
/plugin install job-hunt
```

Then, from the directory you want your job search to live in:

```
/job setup
```

Setup copies in the career files and interviews you to fill them — identity, work authorization,
compensation floor, what roles you want, where you'll work, and your experience. If you have a
resume or LinkedIn export, hand it over and it will draft the career file from that for you to
correct.

That's the whole install. `/job scan` works as soon as setup finishes.

## Requirements

- **Scanning and scoring:** Python 3. Nothing else.
- **Resume building:** [Typst](https://typst.app) and Poppler (`brew install typst poppler`).
- **Filling application forms:** a browser MCP server such as
  [Playwright MCP](https://github.com/microsoft/playwright-mcp).

You can start with just Python and add the rest before your first resume.

## Your files

Setup creates a `career/` directory, split by who owns what.

**You edit these:**

| File | What it's for |
|---|---|
| `index.md` | Your experience and the **answer bank** — the stable answers forms ask for. The only source a resume may draw from. |
| `search-profile.md` | What's worth applying to. Titles, level, location tiers, dealbreakers, and the scoring rubric. The highest-leverage file here. |
| `watchlist.toml` | Which companies to watch, and the mechanical title/location/age filters. |
| `indeed.toml` | The Indeed query matrix and noise filters. |
| `manual-boards.md` | Companies on Workday, iCIMS, or Taleo that the API scan can't reach, checked by hand on a cadence. |
| `resume-patterns.md` | Resume defects worth not repeating. |

**You read these:**

| Path | What it holds |
|---|---|
| `runs/<date>.md` | One note per run — what was scanned, shortlisted, and submitted. |
| `resumes/` | Built resumes. Moves to `resumes/submitted/` when an application goes out. |

**The system owns these** — `.state/` is dot-prefixed, so Obsidian and similar tools ignore it:

| Path | What it holds |
|---|---|
| `.state/applications.jsonl` | Every posting ever seen, with its score and outcome. Append-only. |
| `.state/scans/<date>.json` | The day's candidates, without descriptions. |
| `.state/scans/<date>-jd.json` | Job descriptions, keyed, pulled one at a time. |
| `.state/staged/` | Filled-but-unsubmitted applications, so a lost session is cheap to recover. |

## Upgrading from 1.x

2.0 changes the layout and the config format, so a 1.x `career/` needs converting:

- `scan-config.json` → `watchlist.toml`, `indeed-queries.json` → `indeed.toml`
- `applications.jsonl`, `staged/`, and scan output move under `career/.state/`
- run entries move from `career/jobs/<date>.md` to `career/runs/<date>.md`
- resumes are rendered straight to PDF by Typst; Node and LibreOffice are no longer used

Ask Claude to move an existing `career/` over — the layout above is all it needs.
