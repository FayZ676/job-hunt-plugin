<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.svg">
    <img src="assets/wordmark-light.svg" alt="/job" width="220">
  </picture>
</p>

<p align="center"><strong>The human way to automate job searching</strong></p>

A Claude Code skill that automates the entire job application process, from building your first resume to submitting your last job application. Free and open source. Runs in Claude Code on macOS and Linux.

## How it works

The `/job` SKILL ships with a number of different commands designed to work as you would.

1. **`/job setup`** interviews you and builds your profile. Give it your resume, LinkedIn, GitHub, Blog, Personal Website, or any other source, and it turns all of it into a structured profile.
2. **`/job search`** searches Indeed, in your own browser, for new openings that best fit your profile.
3. **`/job score`** reads each retrieved posting against what you want and shortlists the good fits.
4. **`/job resume`** writes a resume for each shortlisted posting from your actual experience.
5. **`/job apply`** fills in the employer's application form, in your own browser and stops before submitting.
6. **`/job submit`** sends the ones you approve by name.

If all of that is still too much to keep track of, the `/job` command runs everything automatically.

## How it compares

|                                          |  job  | career-ops | ApplyPilot |
| ---------------------------------------- | :---: | :--------: | :--------: |
| Finds, scores, and tailors               |   ✅   |     ✅      |     ✅      |
| Fills and submits the application        |   ✅   |     ❌      |     ✅      |
| Searches in your browser, like a person  |   ✅   |     ❌      |     ❌      |
| Asks before every submit                 |   ✅   |     ➖      |     ❌      |
| Screening answers only from your profile |   ✅   |     ➖      |     ❌      |
| Leaves captchas to a human               |   ✅   |     ➖      |     ❌      |
| No API key                               |   ✅   |     ✅      |     ❌      |

## Getting started

```
git clone https://github.com/FayZ676/job-hunt-plugin.git ~/.claude/skills/job
cd ~/.claude/skills/job && npm install
```

Then run `/job setup` in Claude Code. Setup is a conversation: point it at your resume, LinkedIn
profile, or GitHub, it drafts your profile, and you correct what it got wrong.

You'll need Node 22.18+, a Chrome-family browser, and for resumes,
[Typst](https://github.com/typst/typst#installation) and Poppler. Setup checks for them and installs
what's missing.
## Questions

**Where does my data go?**
It stays on your machine, in one SQLite file under `~/data/job/`.

**What if it keeps showing me the wrong jobs?**
Tell it what's off with `/job feedback`, in plain words. `/job help` lists every command.

**What does it cost?**
The code is MIT licensed. It runs on the Claude Code plan you already pay for.

**Does it work on Windows?**
It hasn't been tested there. If Chrome isn't found, set `JOB_BROWSER_PATH` to its `.exe`, and please
open an issue with whatever else breaks.

## Disclaimer

`job` runs locally and isn't a hosted service. What you approve is yours, and so is following the
terms of the sites it visits.

## License

MIT
