# Application forms per ATS

Reaching, reading and filling a form with the Playwright MCP tools. Phase 4 fills; only Phase 5
submits.

## Who answers a field

Every field is one of three tiers, and the tier decides who answers it:

| Tier | What it is | Source | Auto-filled |
| ---- | ---------- | ------ | ----------- |
| **Identity** | Name, email, phone, location, LinkedIn, GitHub, resume upload | `identity` | Yes |
| **Policy** | Work authorization, sponsorship, EEO, start date, compensation | `identity` | Yes |
| **Judgment** | Screening questions, essays, "why this company" | Nothing stored | No — drafted and flagged |

A judgment question gets the answer the profile supports. Where nothing supports one, flag it for the
user, **except** when a row in `projects` plainly answers it — then answer, cite that project, and
flag `evidence-backed` so the review can check the reasoning. A question needing a project that is
not in `projects` is a flag, not an inference.

## Reaching the form

| ATS | Apply URL | Notes |
| --- | --------- | ----- |
| **Ashby** | Job URL + `/application` | Renders client-side; wait, below |
| **Greenhouse** | `job-boards.greenhouse.io/<slug>/jobs/<id>` | Career pages embed this in an iframe. Go to the canonical URL, from the `gh_jid` in the prospect key |
| **Lever** | `jobs.lever.co/<slug>/<id>/apply` | Server-rendered and predictable, but **submission is gated by hCaptcha** |
| **Workday** | `<company>.wd<N>.myworkdayjobs.com/…` | **Fully drivable.** Needs a per-employer account, then a five-step flow |
| **Everything else** | The row's `url` | iCIMS, SuccessFactors, Oracle Cloud, Rippling, SmartRecruiters, BambooHR, Eightfold and 40-odd more now arrive. Untested, one at a time: **do not assume any of them is blocked** — open it and look before writing it off |

The prospect `key` prefix names the ATS the posting came from — `ashby:`, `greenhouse:`,
`lever.co:`, `workday:`, `icims:` — and `postings.source` holds the same value. There are 54
of them, so **read the prefix rather than expecting a short list.**

**Every `url` is the employer's own posting.** Nothing arrives through an aggregator any more,
so there is no redirect to follow and no listing link to resolve.

An ATS met for the first time is worth a note in this file once it is driven — that is how the table
above earned its rows.

**Wait for the form before snapshotting.** Ashby renders "Fetching application form" first, and a
snapshot taken too early shows a page with no fields on it.

```
browser_navigate  → <apply URL>
browser_wait_for  → textGone: "Fetching application form"
browser_snapshot
```

Greenhouse and Lever are usually ready on load; snapshot and check for field refs before assuming.
Snapshots save to `.playwright-mcp/` rather than returning inline — read the file the tool names, and
clear the directory at the end of a run.

**Check for a duplicate before staging**: `$Q "SELECT status FROM prospects WHERE key='…'"`. A second
application to the same role reads as carelessness and can burn a stated limit.

## Filling

`browser_fill_form` takes a batch of fields, each with a `ref` from the snapshot. Batch the whole
form in one call where possible.

| Field type | Handling |
| ---------- | -------- |
| `textbox` | Direct value through `browser_fill_form` |
| `radio` | Value is the option's exact label text |
| `checkbox` | `true` / `false` |
| `combobox` | Type, then click the option |
| `button` pairs | `browser_click`; confirms by picking up `[active]` |

**Yes/No appears as two shapes, and only the snapshot tells them apart**: `radio` elements, which
`browser_fill_form` sets by label, or `button "Yes"` / `button "No"` pairs, which need
`browser_click` and ignore `fill_form` entirely. Read the element type first.

**Location fields are typeaheads.** Ashby's `Location*` is a combobox with a `Start typing…`
placeholder:

```
browser_type  → target: <combobox ref>, text: "Denver", slowly: true
browser_click → the matching option
```

The dropdown renders as a `listbox` **detached at the very end of the snapshot**, outside the form
container. The first option is highlighted but **not committed until clicked** — confirm by
re-snapshotting: the combobox should read `Denver, Colorado, United States`, not `Denver`.

**Refs go stale after every interaction.** Clicking an option renumbers refs elsewhere on the page —
sponsorship buttons moved `e138/e139` → `e390/e391` after one typeahead selection. Snapshot
immediately before each click; a stale ref errors rather than misclicking, so this costs a retry.

**Resume upload** needs the file chooser triggered first, and absolute paths only. Attach the
tailored PDF for that role, never a generic one.

```
browser_click       → the "Upload File" button
browser_file_upload → paths: ["/absolute/path/to/resume.pdf"]
```

**Skip "Autofill from resume."** Auditing what it guessed costs more than filling the fields
explicitly from the profile.

**The profile stores the answer, not the wording.** `identity.over_18` is `1` and
`identity.employment_type` is `full_time`; the form wants "Yes" and "Full-time". Say it the way
that form says it, and never widen the answer while rewording it -- `0` is "No" however the question
was phrased.

## Before you stop

Re-snapshot and check every required field — marked `*` — holds a value. The silent failures are an
uncommitted typeahead, a radio group that looks answered because one option is visible, and a file
input that never received the upload.

Screenshot the completed form into `$CAREER/resumes/`; that screenshot is what the user reviews.
Then record the application with `job-stage add`, one `--field` per answer.

`job-profile answers` and `job-profile missing` are where the identity and policy answers come from,
and which of them are still `NULL`. Keep the browser tab open; the staged rows survive a lost session
and refilling from them is cheap.

**A start date is computed, not stored.** No employer is `current` and they can start at once;
otherwise it is today plus `identity.notice_period`. Never carry a date over from an earlier
application — the answer moves with the day the form is asked.

**Then stop.** Do not click Submit, Apply, Continue, or Next in Phase 4. On a multi-page form, stop
at the end of the first page and record the page count.

## Lever specifics

**hCaptcha gates the submit button**, and **the challenge is never attempted** — a captcha is an
explicit request for a person. Fill the form, save the staged record, and hand the open tab over: on
a Lever posting, Phase 5 means *they* click submit.

**The resume input is hidden and overlaid by the captcha iframe**, so a normal click times out with
"subtree intercepts pointer events". Click it through the page instead:

```
browser_evaluate    → target: <file input ref>, function: (element) => element.click()
browser_file_upload → paths: ["/absolute/path/resume.pdf"]
```

**Selecting Disability status reveals two more required fields** — a Name and a Date (`MM/DD/YYYY`)
appear under the EEO block only after the dropdown is set, and are required once it is. Re-snapshot
after setting it. **Dismiss the cookie banner first** (Deny works); it overlays the form on load.

## Workday specifics

Verified end to end on a real tenant, 2026-08-18.

**An account is required, one per employer** — tenants are separate. Creation needs an email, a
password (8+ chars, mixed case, numeric, special) and a privacy checkbox, then an emailed activation
link. That link is single-use; "Invalid Token" means the user already clicked it — just sign in.

**Never invent, generate, or store a password.** Ask the user to create one in their password
manager.

**Apply Manually** starts five steps: My Information, My Experience, Application Questions, Voluntary
Disclosures, Review. `Save and Continue` advances and does not submit; only `Submit` on step 5 does.
Each step takes a few seconds to render, so wait before snapshotting.

**Required fields appear mid-flow** — "Are you a previous employee?" only surfaced as a validation
error after the first `Save and Continue`, so read the Errors Found panel rather than assuming the
page was complete. **Work Experience, Education and Skills are optional** when a resume is attached.
**The form carries a bot honeypot**, a hidden input labelled "for robots only" — leave it empty.

## Submitting

Phase 5 only, and only for applications the user named. **A key given with the command is that
naming** — submit that one and nothing else, with no table and no question. Otherwise present every
staged application in one table — company, title, score, status, and whatever is named in
`blocked_on` (`job-submit review`). Keep it to that table; the user reads the applications themselves
in the dashboard. Then ask which to submit, accepting "all", a subset, or none.

```
browser_click    → the submit button
browser_wait_for → confirmation text
browser_snapshot
```

A confirmation reads like "Thank you for applying" or "Application received", usually with the page
replaced. **Validation errors mean nothing was submitted** — repair the named fields and re-present
the application for approval; never resubmit silently. Then `job-submit record`, quoting a
confirmation you have seen in a snapshot.

## Recording a rejection

Only a reported rejection. Do nothing for a role that is merely quiet. `job-submit rejected` takes
the shape in `--note` — days from submission, and whether any interview stage happened.

## Traps

- **Published salary ranges.** Ashby prints the band on the posting. Read it before answering any
  compensation field: answering a $120,000 floor against a published $180K–$240K band anchors the
  negotiation sixty thousand dollars below where the employer opened it.
- **Application limits.** Some companies state them ("5 per 90 days"). `postings` records every
  application with its company and date — count what has already gone there before staging another.
- **Cover letter fields** are usually optional. Leave optional essay fields empty rather than filling
  them with something generic; a weak answer costs more than no answer.
- **"How did you hear about us?"** — answer the company's job board, which is true.
- **Login walls.** Some forms require an account before showing any fields — flag for the user, and
  stage what is reachable.
