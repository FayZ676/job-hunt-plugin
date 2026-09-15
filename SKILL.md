---
name: job
description: Searches Indeed in the browser for new openings, scores them against the search profile, builds a tailored resume for each shortlist, and fills the application form for the user to submit in the browser. Use when the user says "run the job routine", "search and apply", "any new openings", "apply to these", asks for the morning job search, or wants a resume tailored to one posting. `/job setup` on first use, `/job help` for the command list.
argument-hint: [setup|search|resume [JD|url|key]|apply [key|url]|cleanup <what to remove>|feedback <what is wrong>|help]
---

# Job routine

**search → resume → stage.** The deliverable is filled applications, left open in the
browser for the user to review and submit.

## Invariants

Nothing below overrides these.

1. **Never click submit, and never delete unattended.** The user submits every application
   themselves, in the browser.
2. **Never write an answer the profile does not support.** `NULL` is a hard stop: leave the field
   empty and report it — `cli/profile.ts missing` lists every one that will block an application.
   Never infer a phone number, a salary, or a demographic answer.
3. **Answer to the truth, including when it costs the application.** A commitment in the profile is
   a ceiling, not an opening position.
4. **Essays and screening answers are drafted, never auto-accepted.**
5. **Chat output is minimal.** Only what blocks progress and needs the user belongs in chat — named specifically, which role and which field. No
   progress narration, no action transitions, no summaries; the database is the record. A run with
   nothing to ask about produces no chat output at all. `/job help`, `/job feedback` and
   `/job setup` are the exceptions — feedback is answered with what changed, and setup is an
   interview paced by `cli/setup.ts`.
6. **A captcha, or anything else asking for a human, stops the run the moment it appears.** A
   challenge checkbox or puzzle, a "verify you are human" or press-and-hold page, a Cloudflare
   interstitial, a one-time code sent to the user's email or phone. Never attempt it and never route
   around it: no reload, no new tab, no search for another copy of the form, no moving on to the next
   posting. Ask in chat, naming the role and the tab, and do nothing more until the user says it is
   cleared.

## Modes

| Invocation | Runs | Read first |
| ---------- | ---- | ---------- |
| `/job setup` | First-run setup | `references/setup.md` |
| `/job` | Every action, in order | each action's file, as it starts |
| `/job search` | Harvest Indeed in the browser, rule on what came back, then score every prospect | `references/searching.md`, then `references/scoring.md` |
| `/job resume [JD, URL, or key]` | Build a resume for every `shortlisted` posting, or the one named | `references/resume.md` |
| `/job apply [key or URL]` | Resume, then stage, every `shortlisted` posting, or the one named | `references/applying.md` |
| `/job cleanup <what to remove>` | Remove postings, and their resumes, from the database | `references/cleanup.md` |
| `/job feedback <what is wrong>` | Change what produced it — instructions, profile, or this skill | `references/feedback.md` |
| `/job help` | `cli/help.ts` and nothing else — no run, no queries, no commentary | |

**If `$CAREER` does not exist, run setup first** — `/job` before setup is a no-op. Adding a mode
means adding it to the table above and to `lib/core/actions.ts`.

Three files are not an action and are read when they apply:

| File | Read before |
| ---- | ----------- |
| `references/writing.md` | Writing anything a person reads — resume bullets, cover letter, screening answers |
| `references/storage.md` | Any query, any write to the profile, anything the user asks about their search |
| `references/architecture.md` | Changing the code, or installing it |

**Commands are the scripts in this skill's `cli/`.** The shell does not start in this skill's
directory, so run each by its absolute path — `cli/q.ts` here and in every reference means
`<this skill's base directory>/cli/q.ts`.

**The code is the manual for anything it already decides**, so no file above restates it. Every
script in `cli/` takes `--help`, and that is the contract — what an action accepts, what it
defaults to, and what it gives back. Read it before invoking rather than reading the source, and
never carry a flag from a file here that `--help` does not list.

**Playwright MCP attaches to a Chrome that `cli/browser.ts` starts and leaves running**, so the browser
outlives this conversation: a tab left open is still open when the user comes back to it, and a
captcha they solve stays solved. Hand a tab over rather than closing it — never `browser_close` — and
if the tools reach no browser, run `cli/browser.ts`.

**What a command needs and the profile does not hold, ask for.** Read the profile first; if the
answer is not there and the user did not say it, ask them — never infer it, and never let a value
they would have chosen come from a fallback. An answer that is a fact about them goes into the
profile that turn, or the next run asks again.

```bash
$Q --schema                  # every table, view, CHECK and trigger; $Q is cli/q.ts
cli/search.ts dispositions   # every verdict the chain can rule, in order
cli/resume.ts spec           # the resume spec, and every section type
cli/profile.ts missing       # every NULL, each one a hard stop
```

Each action is self-contained and knows nothing of the others, so any step can be redone without
the ones before it. Nothing here costs money or needs a key: `search` is Indeed, navigated in the
browser, so **the queries you build are the whole reach of the search** — a role worded in a way
none of them match is the one failure mode.
