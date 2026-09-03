---
name: job
description: Searches every company career site for new openings, scores them against the search profile, builds a tailored resume for each shortlist, fills the application form, and submits what the user approves. Use when the user says "run the job routine", "search and apply", "any new openings", "apply to these", asks for the morning job search, or wants a resume tailored to one posting. `/job setup` on first use, `/job help` for the command list.
argument-hint: [setup|search|score [key]|resume [JD|url|key]|apply [key|url]|submit [key]|feedback <what is wrong>|ui|help]
---

# Job routine

**search → score → resume → stage → submit.** The deliverable is submitted applications, recorded. A
run that stages four and submits none has not finished; it is waiting on the user.

## Invariants

Nothing below overrides these.

1. **Everything up to the submit click is unattended. The submit click never is.** Submit only what
   the user names, in that run. Silence is not approval, and an unapproved application stays staged
   rather than going out on a later run.
2. **Never write an answer the profile does not support.** `NULL` is a hard stop: leave the field
   empty and report it — `job-profile missing` lists every one that will block an application.
   Never infer a phone number, a salary, or a demographic answer.
3. **Answer to the truth, including when it costs the application.** A commitment in the profile is
   a ceiling, not an opening position.
4. **`applied` requires a confirmation page you have seen.** Clicking the button is not evidence.
5. **Essays and screening answers are drafted, never auto-accepted.**
6. **Chat output is minimal.** Only two things belong in chat: the submit approval prompt, and
   whatever blocks progress and needs the user — named specifically, which role and which field. No
   progress narration, no action transitions, no summaries; the run entry is the record. A run with
   nothing to ask about produces no chat output at all. `/job help` and `/job feedback` are the
   exceptions — feedback is answered with what changed.

## Modes

| Invocation | Runs | Read first |
| ---------- | ---- | ---------- |
| `/job setup` | First-run setup | `references/setup.md` |
| `/job` | Every action, in order | each action's file, as it starts |
| `/job search` | Find the openings, and rule on them | `references/searching.md` |
| `/job score [key]` | Score every prospect, or the one named | `references/scoring.md` |
| `/job resume [JD, URL, or key]` | Build a resume for every `shortlisted` posting, or the one named | `references/resume.md` |
| `/job apply [key or URL]` | Resume, then stage, every `shortlisted` posting, or the one named, stopping before submit | `references/applying.md` |
| `/job submit [key]` | Submit what is staged, or the one named | `references/submitting.md` |
| `/job feedback <what is wrong>` | Change what produced it — instructions, profile, filters, or this skill | `references/feedback.md` |
| `/job ui` | Serve the dashboard — `npm run dev` in the skill directory, on `127.0.0.1:8765`; the profile is edited there | `references/storage.md` |
| `/job help` | `job-help` and nothing else — no run, no queries, no commentary | |

**If `$CAREER` does not exist, run setup first** — `/job` before setup is a no-op. Adding a mode
means adding it to the table above and to `lib/core/actions.ts`.

Two files are not an action and are read when they apply:

| File | Read before |
| ---- | ----------- |
| `references/storage.md` | Any query, any write to the profile, anything the user asks about their search |
| `references/architecture.md` | Changing the code, or installing it |

**The code is the manual for anything it already decides**, so no file above restates it. Every
`job-*` command takes `--help`, and that is the contract — what an action accepts, what it
defaults to, and what it gives back. Read it before invoking rather than reading the source, and
never carry a flag from a file here that `--help` does not list.

**What a command needs and the profile does not hold, ask for.** Read the profile first; if the
answer is not there and the user did not say it, ask them — never infer it, and never let a value
they would have chosen come from a fallback.

```bash
$Q --schema                      # every table, view, CHECK and trigger; $Q is job-q
job-search dispositions          # every verdict the chain can rule, in order
job-resume spec                  # the resume spec, and every section type
job-profile missing              # every NULL, each one a hard stop
```

Each action is self-contained and knows nothing of the others, so any step can be redone without
the ones before it. **The expensive one is `search`** — one paid call, billed per job returned.
Everything after it is free to repeat.
