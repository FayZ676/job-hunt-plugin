<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.svg">
    <img src="assets/wordmark-light.svg" alt="/job" width="220">
  </picture>
</p>

<p align="center"><strong>The human way to automate job searching</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <a href="https://claude.com/claude-code"><img alt="Built for Claude Code" src="https://img.shields.io/badge/built%20for-Claude%20Code-d97757"></a>
  <a href="https://nodejs.org"><img alt="Node 22.18+" src="https://img.shields.io/badge/node-22.18%2B-339933"></a>
  <img alt="macOS and Linux" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey">
</p>

A Claude Code skill that automates the entire job application process, from writing your first resume to submitting your last job application. Free and open source. Works on macOS and Linux.

## How it works

1. **`/job setup`** asks about your work history and what you're looking for. Give it your resume, LinkedIn, GitHub, website, or anything else that describes your work.
2. **`/job search`** searches Indeed for new jobs in your own browser, compares each one to what you want, and picks the best matches.
3. **`/job resume`** writes a resume for each of those jobs, using only your real experience.
4. **`/job apply`** opens each employer's application, fills it in, and leaves it open for you to check and submit.

Or run `/job` to do all four in order.

## How it compares

|                                                  | job | [career-ops](https://github.com/career-ops-hq/career-ops) | [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) | [ApplyPilot](https://github.com/Pickle-Pixel/ApplyPilot) |
| ------------------------------------------------ | :-: | :------------------------------------------------------: | :-------------------------------------------------------------: | :------------------------------------------------------: |
| Fills out the application for you                | ✅  |                            ✅                            |                               ❌                                |                            ✅                            |
| Nothing is sent until you review and submit it   | ✅  |                            ✅                            |                               ✅                                |                            ❌                            |
| One command takes you from search to application | ✅  |                            ❌                            |                               ❌                                |                            ✅                            |
| No API key to set up                             | ✅  |                            ✅                            |                               ✅                                |                            ❌                            |
| Works on Windows                                 | ❌  |                            ✅                            |                               ✅                                |                        Not stated                        |
| Works with coding agents besides Claude Code     | ❌  |                            ✅                            |                           Search only                           |                            ❌                            |
| Lines of prompt | ~1,000 lines |                       ~9,000 lines                       |                          ~6,000 lines                           |                            —                             |

Based on each project's own documentation, as of September 2026.

## Getting started

You'll need [Claude Code](https://claude.com/claude-code), Node 22.18 or newer, and Chrome, Chromium, or Edge.

1. **Install the skill:**

   ```
   git clone https://github.com/FayZ676/job-skill.git ~/.claude/skills/job
   ```

2. **Run `/job setup` in Claude Code.** Give it your resume, LinkedIn, or GitHub. It writes up your
   profile, and you fix anything it got wrong.

3. **Run `/job`.** It finds jobs, ranks them, writes resumes, and leaves filled-in applications open
   in your browser for you to submit.

## The dashboard

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/dashboard-jobs-dark.png">
  <img alt="The job list beside a run asking for input" src="assets/dashboard-jobs-light.png">
</picture>

Rather not use the terminal? The dashboard is an app that runs in your browser, on your own computer,
and lets you do the same things with buttons.

- **No commands.** Each job has a button for its next step.
- **Jobs that need you come first.** Each job shows why it was ranked where it was, next to the
  resume written for it.
- **Edit your profile directly.** It shows which application questions you haven't answered yet,
  before they hold up an application.
- **Runs on your computer.** No account needed. It uses the same data as the skill.

The dashboard is invite-only for now. [Request access](https://github.com/FayZ676/job-hunt-dashboard).

## Questions

**Where does my data go?**
It stays on your computer, in a single database file in `~/data/job/`.

**What if it keeps showing me the wrong jobs?**
Run `/job feedback` and describe what's wrong. `/job help` lists every command.

**What does it cost?**
Nothing extra. It's free and uses the Claude Code plan you already have.

**Does it work on Windows?**
It hasn't been tested on Windows. If it can't find Chrome, set `JOB_BROWSER_PATH` to the location of
`chrome.exe`. Please open an issue for anything else that breaks.

## Disclaimer

`job` runs on your computer. It isn't an online service. You're responsible for the applications you
submit and for following the rules of the sites it uses.

## License

MIT
