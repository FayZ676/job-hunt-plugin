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
- **Resume building:** Node with the `docx` package (`npm install -g docx`), and LibreOffice for
  PDF conversion (`brew install --cask libreoffice`).
- **Filling application forms:** a browser MCP server such as
  [Playwright MCP](https://github.com/microsoft/playwright-mcp).

You can start with just Python and add the rest before your first resume.

## Your files

Setup creates a `career/` directory. Everything in it is yours — the plugin reads and writes it, but
it never leaves your machine.

| File | What it's for |
|---|---|
| `index.md` | Your experience and the **answer bank** — the stable answers forms ask for. The only source a resume may draw from. |
| `search-profile.md` | What's worth applying to. Titles, level, location tiers, dealbreakers, and the scoring rubric. The highest-leverage file here. |
| `scan-config.json` | Which companies to watch and the mechanical title/location/age filters. |
| `indeed-queries.json` | The Indeed query matrix and noise filters. |
| `manual-boards.md` | Companies on Workday, iCIMS, or Taleo that the API scan can't reach, checked by hand on a cadence. |
| `applications.jsonl` | Every posting ever seen, with its score and outcome. Append-only. |
| `jobs/<date>.md` | One note per run — what was scanned, what was shortlisted, what was submitted. |
| `resumes/` | Built resumes. Moves to `resumes/submitted/` when an application goes out. |
| `staged/` | Filled-but-unsubmitted applications, so a lost session is cheap to recover. |

`career/` is gitignored by default. It has your phone number in it.

## Commands

| Command | What it runs |
|---|---|
| `/job setup` | First-run setup |
| `/job` | All five phases |
| `/job scan` | Scan and score, stopping at the review note |
| `/job scan --no-indeed` | Watched boards only |
| `/job indeed` | The Indeed pass on its own |
| `/job resume <JD, URL, or ledger key>` | Build one resume |
| `/job apply <ledger key or URL>` | Build and stage one application, stopping before submit |
| `/job submit` | Review and submit whatever is staged |

## The rules it won't break

These are load-bearing, not decoration:

- **It never submits without your approval** for that specific application, in that run. Silence is
  not approval.
- **It never writes an answer your career file doesn't support.** A missing answer is a hard stop,
  not a guess — it will not infer a phone number, a salary, or a demographic answer.
- **It never puts a number on a resume that isn't in your career file.** No rounding up.
- **It answers honestly even when that ends the application.** A start time you can't commit to is
  answered as a start time you can't commit to.
- **It records `applied` only after verifying a confirmation page.** Clicking the button isn't
  evidence.

## Tuning it

The shipped watchlist and title filters are tuned for AI and machine learning engineering roles. If
you're searching in a different field, rewrite `title_include` in `scan-config.json` and replace the
companies list — it's a starting point, not a recommendation.

The one file worth real time is `search-profile.md`. Every score comes from it, and the fastest way
to improve results is to edit it whenever a scan surfaces something you'd never apply to, or misses
something you would.

## License

MIT
