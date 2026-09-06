# job-hunt

A Claude Code skill that runs your job search end to end: it crawls the career sites of the
employers you choose, scores every new opening against your profile, tailors a resume for the ones
worth applying to, fills the application form, and submits only what you approve. Every result is
the employer's own posting — no aggregator, no gig spam.

Postings come straight off each employer's applicant tracking system, so there is no API key to
get, no search quota, and no bill. It ships knowing Greenhouse, Ashby, Lever, SmartRecruiters and
Workday, and a new one is a single file under `lib/core/fetch/ats`.

```
/job
```

Five actions — search, score, resume, stage, submit — over one SQLite database. `/job` runs them in
order; any one also runs on its own. It never submits without your approval for that application,
and never writes an answer your profile doesn't support.

## Requirements

- Node 22.18+
- [Typst](https://typst.app) and Poppler, for resumes: `brew install typst poppler`
- A browser MCP server, for filling forms — such as
  [Playwright MCP](https://github.com/microsoft/playwright-mcp). It drives its own browser by
  default; `--extension` plus the
  [Playwright Extension](https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm)
  points it at your own Chrome instead, so applications reuse accounts you're already signed into.

Node alone is enough to start. Add the rest before your first resume.

## Install

```
git clone https://github.com/FayZ676/job-hunt-plugin.git ~/.claude/skills/job
npm install --prefix ~/.claude/skills/job
npm link --prefix ~/.claude/skills/job
```

Then `/job setup`, which interviews you, builds your profile, and registers a starting set of
employers to crawl — hand it a resume or LinkedIn export and it drafts the whole thing for you to
correct. `/job companies` changes who gets crawled at any time. `/job help` lists every command; `/job ui`
serves a dashboard for editing your profile and watching the actions run.

## Your files

Everything lives in `~/data/job/`: one SQLite database, plus the resumes it builds. It sits outside
this repository and is never committed — it has your phone number in it. `JOB_CAREER_DIR` moves it.

## Upgrading

3.0 replaced the file-based store with a database, and the markdown profile with a structured one.
Ask Claude to migrate an existing `career/`.

## License

MIT
