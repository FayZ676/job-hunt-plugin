# job

**Wake up to applications ready to send.**

Job hunting is the same four hours every day: scroll the listings, skip the ones that don't fit,
rewrite your resume, retype your address into another form. `job` is a Claude Code skill that does
all of it, and stops at the one step that should stay yours — clicking submit.

```
/job
```

1. **Searches** Indeed in your own browser. No API key, no quota, no bill.
2. **Scores** every new opening against what you told it you want, and drops the rest.
3. **Tailors** a resume to each posting worth your time.
4. **Fills** the application on the employer's own site — Greenhouse, Ashby, Workday, Lever.
5. **Submits** only the ones you approve, by name.

## It won't embarrass you

- **Nothing goes out without your yes.** Silence is not approval.
- **Nothing is made up.** No answer on file means an empty field and a question for you, never a
  guess at your salary, phone number, or visa status.
- **Captchas are yours.** It stops and hands you the tab, which stays open until you come back.
- **Your data stays on your machine**, in one SQLite file under `~/data/job/`.

## Install

```
git clone https://github.com/FayZ676/job-hunt-plugin.git ~/.claude/skills/job
cd ~/.claude/skills/job && npm install
```

Then run `/job setup`. Hand it your resume or LinkedIn export and it drafts your profile for you to
correct.

Needs Node 22.18+ and a Chrome-family browser. For resumes, add `brew install typst poppler`.

`/job help` lists every command; `/job feedback` changes what it looks for, in plain words.

## License

MIT
