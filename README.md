# job-hunt

A Claude Code skill that runs a job search end to end: it scans company job boards for new
openings, scores each one against a profile you never have to format, builds a tailored resume for
the ones worth applying to, fills out the application form in the browser, and submits only what you
approve.

One command does the whole thing:

```
/job
```

## What it actually does

Five phases, in order.

| Phase | What happens |
|---|---|
| **Scan** | Hits the Greenhouse, Lever, and Ashby APIs for every company you watch, plus an Indeed pass for employers nobody put on a list. Ships with a 137-company starter watchlist. Fetching and filtering are separate steps: everything a source returned lands in `postings` untouched, and one pass rules on each row; the ones
it keeps are the prospects. |
| **Score** | Triages on a cheap list with no descriptions, pulls full text only for the plausible ones, then scores 0–10 against your profile — citing the JD language that drove it. Everything is recorded, shortlisted or not, so nothing is reviewed twice. |
| **Resume** | Builds a role-specific resume straight to PDF, selecting the bullets in your profile that match this posting. It never invents a number your profile doesn't have. |
| **Stage** | Opens the application form and fills every field your profile answers. An unanswered field is a hard stop, not a guess. Screening questions and essays get drafted and flagged, never auto-accepted. Stops with a finger over the submit button. |
| **Submit** | Shows you everything staged, with every drafted essay in full, and asks which to send. Submits only what you name, then verifies the confirmation page. |

**The submit click is never unattended.** Everything before it is.

There are two halves, and one database between them. `jobhunt/` is the Python package that stands
between the jobs and the database: one module per phase under `jobhunt/phases/` — `scan.py`,
`score.py`, `resume.py`, `stage.py`, `submit.py` — so any step can be run or redone on its own, plus
what they share and `q.py` for SQL. `dashboard/` is a Next.js app that stands between you and the
database, and is the only thing that writes your profile. `sql/` belongs to neither: both halves
apply it on every connect. The rules above are enforced in those modules, not just described: the
scorer refuses a posting whose description was never read, staging refuses an application with no
built resume, and nothing is marked applied without the confirmation text you saw.

## Install

Clone it into your skills directory, where Claude Code picks it up as `/job`:

```
git clone https://github.com/FayZ676/job-hunt-plugin.git ~/.claude/skills/job
pip install ~/.claude/skills/job
npm install --prefix ~/.claude/skills/job/dashboard
```

The `pip install` brings in the dependencies and puts the phases on your `PATH` as `job-scan`,
`job-score`, `job-resume`, `job-stage`, `job-submit`, `job-q` and `job-paths`. The `npm install` is
the dashboard, and is needed once before `/job ui`.

Then, from anywhere:

```
/job setup
```

Setup interviews you — identity, work authorization, compensation floor, what roles you want, where
you'll work, and your experience — and writes it into your profile. If you have a resume or LinkedIn
export, hand it over and it drafts the whole thing for you to correct.

That's the whole install. `/job scan` works as soon as setup finishes.

Adding a new place to look for jobs is one entry in `sources.REGISTRY` (`jobhunt/sources.py`) —
a function that returns `Posting` objects. Filtering, deduping, scoring, resumes and applying are unchanged by it, because
no step below fetching knows which source a row came from.

## Your files

Setup creates one thing: **`~/data/job/job.db`**, a single SQLite database. That location is
fixed and absolute, so `/job` behaves the same no matter where you run it; set `JOB_CAREER_DIR` to
put it somewhere else.

It holds your profile — identity, the answers application forms ask for, your employers and
projects, and what you're looking for — alongside every posting ever fetched, every prospect derived
from one, the companies you watch, your filters, staged applications, and the history of each role. You never edit it by hand: tell
Claude about a job you had, paste a resume, upload a CV, and it writes the rows. You talk; the data
stays consistent. There are no per-day scan files — a scan updates the database, and a question
about your search is a query. Because the raw layer is kept, "what did that filter cost me?" is also
a query, and a filter you change re-runs over this morning's fetch without touching the network.

```
you: which companies rejected me fastest?
you: what did I apply to in August that's still quiet?
you: stop showing me contract roles
```

Built resumes land in `~/data/job/resumes/`, moving to `submitted/` when an application goes out.
That is the only output on disk — the database is the record, and reporting is a query answered in
the conversation.

Your career directory lives outside this repository, and nothing in it is ever committed. It has
your phone number in it.

## Requirements

- **Scanning and scoring:** Python 3.10+ and `pip install ~/.claude/skills/job`, which installs the
  `jobhunt` package and its dependencies. SQLite ships with Python.
- **Resume building:** [Typst](https://typst.app) and Poppler (`brew install typst poppler`).
- **Filling application forms:** a browser MCP server such as
  [Playwright MCP](https://github.com/microsoft/playwright-mcp).
- **The dashboard:** Node 20+, and `npm install` in `dashboard/` once.

You can start with just Python and add the rest before your first resume.

## Commands

| Command | What it runs |
|---|---|
| `/job setup` | First-run setup |
| `/job` | All five phases |
| `/job scan` | Scan and score (`--no-indeed` for watched boards only) |
| `/job indeed` | The Indeed pass on its own |
| `/job resume <JD, URL, or key>` | Build one resume |
| `/job apply <key or URL>` | Build and stage one application, stopping before submit |
| `/job submit` | Review and submit whatever is staged |
| `/job ui` | Serve the dashboard, and edit your profile in it |
| `/job help` | Print the command list |

## The dashboard

Chat is how you change the search; the dashboard is how you see it — and how you change
yourself, which is the part worth your attention.

```
/job ui
```

That serves a local page on `127.0.0.1`: the jobs, each one opening on its full application with
every drafted essay and flagged field in it, your whole profile with its unanswered fields called
out, and the watchlist.

**The Profile page is editable.** Every box on it — your answers, your employers and projects, the
bullets a resume draws on, your search criteria, the facts that must never be misreported — saves
the moment you leave it, and emptying a box takes the answer back to unanswered, which is a hard
stop rather than a guess. Nothing else is: postings, scores and staged forms are read-only there,
because the rules that make those writes safe live in the phases, not in a web page. The dashboard
names the profile tables it may write and refuses every other one, and a write that arrives from
another origin is refused before it reaches one, so another tab cannot reach in.

It has one button. **Run** opens your terminal — Terminal on macOS, Windows Terminal on Windows — on
an interactive `claude "/job"`, so the phases that need your approval still get to ask for it. The
page starts the skill; the skill does the writing, under the rules below. That endpoint is guarded
by a per-session token and only ever runs a command from a fixed list, so a stray page in another
browser tab cannot trigger it.

You can also just ask questions — "what's still waiting on me", "did anyone reject me this week" —
and they're answered from the database.

## The rules it won't break

These are load-bearing, not decoration:

- **It never submits without your approval** for that specific application, in that run. Silence is
  not approval.
- **It never writes an answer your profile doesn't support.** A missing answer is a hard stop, not a
  guess — it will not infer a phone number, a salary, or a demographic answer.
- **It never puts a number on a resume that isn't in your profile.** No rounding up.
- **It answers honestly even when that ends the application.** A start time you can't commit to is
  answered as a start time you can't commit to.
- **It records an application as sent only after verifying a confirmation page.** Clicking the
  button isn't evidence.

## Tuning it

The seeded watchlist and title filters are tuned for AI and machine learning engineering roles. If
you're searching in a different field, say so — the companies and filters are database rows, and
Claude edits them for you.

The highest-leverage thing you can do is correct the profile when a scan surfaces something you'd
never apply to, or misses something you would. Its `search_notes` field holds the reasoning that no
schema captures, and it's read on every scoring pass.

## Upgrading from earlier versions

3.0 replaces the file-based store with a database, and the markdown profile with a structured one.
Ask Claude to migrate an existing `career/` — it reads the old `index.md`, `search-profile.md` and
`applications.jsonl`, and writes it all into the database.

## License

MIT
