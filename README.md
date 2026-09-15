<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.svg">
    <img src="assets/wordmark-light.svg" alt="/job" width="220">
  </picture>
</p>

<p align="center"><strong>The human way to automate a job search.</strong><br>It applies the way you would, just much faster, and automatically.</p>

Job hunting is the same four hours every day: scroll the listings, skip the ones that don't fit,
rewrite your resume, retype your address into another form. `job` is a Claude Code skill that does
all of it the way you would by hand, and stops at the one step that should stay yours.

```
/job
```

One command. It searches, scores, tailors, fills, and then asks you which ones to send.

---

## What It Does

| Step          | What happens                                                                  |
| ------------- | ----------------------------------------------------------------------------- |
| **1. Search** | Searches Indeed in your own browser, the way you would. No API key, no quota. |
| **2. Score**  | Reads every new posting against what you said you want, and drops the rest.   |
| **3. Tailor** | Builds a resume for each posting worth your time, from your real experience.  |
| **4. Fill**   | Opens the application on the employer's own site and fills it in.             |
| **5. Submit** | Sends only the ones you name. Everything else waits.                          |

Each step also runs on its own: `/job search`, `/job score`, `/job resume`, `/job apply`, `/job submit`.

## The Human Approach

Most job bots scrape, spray, and fake their way past the checks meant to stop them. Recruiters can
tell. `job` does what you would do, only faster.

- **It browses like you.** Your own Chrome, searching Indeed the way a person does. No scraping, no
  API, no bot traffic.
- **It writes like you.** Resumes and answers in your voice, from your real record. Never a claim
  you couldn't defend in the interview.
- **It stops for a human.** A captcha, a verification code, a question your profile can't answer:
  it pauses and hands you the tab. It never tries to get around one.
- **It sends what you'd send.** A few applications you chose, not hundreds you've never seen.

## Why This One

|                                          |  job  | career-ops | ApplyPilot |
| ---------------------------------------- | :---: | :--------: | :--------: |
| Finds, scores, and tailors               |   ✅   |     ✅      |     ✅      |
| Fills and submits the application        |   ✅   |     ❌      |     ✅      |
| Searches in your browser, like a person  |   ✅   |     ❌      |     ❌      |
| Asks before every submit                 |   ✅   |     ➖      |     ❌      |
| Screening answers only from your profile |   ✅   |     ➖      |     ❌      |
| Leaves captchas to a human               |   ✅   |     ➖      |     ❌      |
| No API key                               |   ✅   |     ✅      |     ❌      |

## Quick Start

```
git clone https://github.com/FayZ676/job-hunt-plugin.git ~/.claude/skills/job
cd ~/.claude/skills/job && npm install
```

Then, in Claude Code:

```
/job setup
```

**Hand it your resume or LinkedIn export. It drafts your profile by chatting. Nothing to edit by hand.**

Needs Node 22.18+ and a Chrome-family browser. For resumes, add `brew install typst poppler`.

## Where It Applies

| Site              |                                                                   |
| ----------------- | ----------------------------------------------------------------- |
| Greenhouse, Ashby | Filled and submitted                                              |
| Workday           | Filled and submitted, once you have an account with that employer |
| Lever             | Filled; you click submit past its captcha                         |
| Anything else     | Opened for you, one at a time                                     |

## FAQ

**Does it apply without asking?**
No. It fills everything up to the submit button, then asks. Silence is not approval.

**Will it make things up?**
No. If your profile doesn't have the answer, the field stays empty and it asks you. It never guesses
a salary, a phone number, or a visa status.

**Where does my data go?**
Nowhere. One SQLite file in `~/data/job/`, on your machine.

**How do I change what it looks for?**
Tell it: `/job feedback <what's wrong>`. `/job help` lists every command.

**Is it free?**
Yes, MIT licensed. It runs on your existing Claude Code plan.

## Disclaimer

`job` is a local tool, not a hosted service. You are responsible for what you submit and for
following the terms of the sites it visits. Review before you approve.

## License

MIT
