# job

A Claude Code skill that runs your job search end to end: it searches Indeed in your browser, scores
every new opening against your profile, tailors a resume for the ones worth applying to, fills the
application form on the employer's own ATS, and submits only what you approve.

Indeed is navigated the way a person would, so there is no API key to get, no search quota, and no
bill — and no list of employers to maintain, since the queries you search are the whole reach.
Applications are resolved back to the employer's own form: Greenhouse and Ashby are driven all the
way to submitted, Workday too once you have made an account with that employer, Lever is filled for
you but its hCaptcha leaves the submit click to you, and the rest are opened one at a time.

```
/job
```

Five actions — search, score, resume, stage, submit — over one SQLite database. `/job` runs them in
order; any one also runs on its own. It never submits without your approval for that application,
and never writes an answer your profile doesn't support.

## Requirements

- Node 22.18+
- [Typst](https://typst.app) and Poppler, for resumes: `brew install typst poppler`
- A Chrome-family browser, for searching and filling forms. `.mcp.json` points
  [Playwright MCP](https://github.com/microsoft/playwright-mcp) at one that `job-browser` starts and
  leaves running, on `127.0.0.1:9222`, with its own profile in `~/data/job/browser` — so a captcha or
  a half-filled form is still waiting when you answer, instead of dying with the conversation that
  opened it.

Node alone is enough to start. Add the rest before your first resume.

## Install

Put this directory at `~/.claude/skills/job` — a symlink works — then install it. From this
directory:

```
ln -s "$PWD" ~/.claude/skills/job
npm install --prefix ~/.claude/skills/job
npm link --prefix ~/.claude/skills/job
```

Then `/job setup`, which interviews you and builds your profile — hand it a resume or LinkedIn
export and it drafts the whole thing for you to correct. What the search looks for comes out of that
interview, in your words, and `/job feedback` changes it at any time. `/job help` lists every command.

## Your files

Everything lives in `~/data/job/`: one SQLite database, plus the resumes it builds. It sits outside
this directory and is never committed — it has your phone number in it. `JOB_CAREER_DIR` moves it.

## Upgrading

3.0 replaced the file-based store with a database, and the markdown profile with a structured one.
Ask Claude to migrate an existing `career/`.

## License

MIT
