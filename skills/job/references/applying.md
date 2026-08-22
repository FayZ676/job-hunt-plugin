# Application forms per ATS

How to reach, read, and fill an application form with the Playwright MCP tools. Phase 4 of `/job`
fills; only phase 5 submits.

## Reaching the form

| ATS | Apply URL | Notes |
| --- | --------- | ----- |
| **Ashby** | Job URL + `/application` | Renders client-side; see the wait below |
| **Greenhouse** | `job-boards.greenhouse.io/<slug>/jobs/<id>` | Company career pages embed this in an iframe. Go to the canonical URL directly, from the `gh_jid` in the prospect key |
| **Lever** | `jobs.lever.co/<slug>/<id>/apply` | Server-rendered and predictable to fill, but **submission is gated by hCaptcha** — see below |
| **Workday** | `<company>.wd<N>.myworkdayjobs.com/...` | **Fully drivable.** Needs a per-employer account; then Apply Manually runs a five-step flow — see below |
| **iCIMS, Taleo, SmartRecruiters** | varies | Untested. Do not assume they are blocked — try one before writing them off |

The prospect `key` prefix names the ATS: `ashby:`, `greenhouse:`, `lever:`, `manual:`.

## Reading the form

**Wait for the form before snapshotting.** Ashby renders "Fetching application form" first, and a
snapshot taken too early shows a page with no fields on it.

```
browser_navigate  → <apply URL>
browser_wait_for  → textGone: "Fetching application form"
browser_snapshot
```

Greenhouse and Lever are usually ready on load; snapshot and check for field refs before assuming.

Snapshots save to `.playwright-mcp/` in the working directory rather than returning inline. Read the
file the tool names. These accumulate in the vault root — clear them at the end of a run.

## Filling

`browser_fill_form` takes a batch of fields, each with the `ref` from the snapshot. Batch the whole
form in one call where possible; refs go stale after the page re-renders.

| Field type | Handling |
| ---------- | -------- |
| `textbox` | Direct value through `browser_fill_form` |
| `radio` | Value is the option's exact label text |
| `checkbox` | `true` / `false` |
| `combobox` | Type, then click the option — see below |
| `button` pairs | Click. See below |

**Yes/No appears as two shapes, and the snapshot is the only way to tell them apart.** Cohere's form
renders them as `radio` elements, which `browser_fill_form` sets by label. Deepgram's renders them as
`button "Yes"` / `button "No"` pairs, which need `browser_click` and ignore `fill_form` entirely.
Read the element type in the snapshot before choosing the tool. A clicked button confirms by picking
up `[active]`; verify that before moving on.

**Location fields are typeaheads.** Ashby's `Location*` is a combobox with a `Start typing...`
placeholder:

```
browser_type  → target: <combobox ref>, text: "Denver", slowly: true
browser_click → the matching option
```

The dropdown renders as a `listbox` **detached at the very end of the snapshot**, outside the form
container — scroll to the bottom of the file to find the options. Typing `Denver` returns Denver
OR, ME, Victoria AU, Jamaica, and TX; the first is highlighted but **not committed until clicked**.
Confirm by re-snapshotting: the combobox should read `Denver, Colorado, United States` rather than
`Denver`.

**Refs go stale after every interaction.** Clicking an option renumbers refs elsewhere on the page —
the sponsorship buttons moved from `e138/e139` to `e390/e391` after one typeahead selection. Snapshot
immediately before each click. A stale ref errors rather than misclicking, so this costs a retry
instead of a wrong answer.

**Resume upload** needs the file chooser triggered first:

```
browser_click       → the "Upload File" button
browser_file_upload → paths: ["/absolute/path/to/resume.pdf"]
```

Absolute paths only. Attach the tailored PDF for that role, never a generic one.

**Skip "Autofill from resume."** Ashby and Greenhouse both offer it. It parses the PDF and populates
fields with values that have to be audited afterward, which costs more than filling them from the
answer bank. Fill explicitly.

## Verifying before you stop

Re-snapshot after filling and check every required field — marked `*` — holds a value. The common
silent failures are an unselected typeahead, a radio group that looks answered because one option is
visible, and a file input that never received the upload.

Screenshot the completed form into `career/resumes/`. That screenshot is what the user reviews.

**Then stop.** Do not click a control labeled Submit, Apply, Continue, or Next in phase 4. On a
multi-page form, stop at the end of the first page and record the page count.

## Lever specifics

**hCaptcha gates the submit button.** Seen on some Greenhouse boards: every field filled and the
resume attached, and clicking "Submit application" re-triggered a nine-image challenge instead of
submitting. The page stays put and nothing is sent.

**Never attempt the challenge.** A captcha is an explicit request for a person. Fill the form, save
the staged record, and hand the open tab to the user to finish. Phase 5 on a Lever posting means *they*
clicks submit; the skill's job ends at a complete form.

**The resume input is hidden and overlaid by the captcha iframe**, so a normal click times out with
"subtree intercepts pointer events". Click the input through the page instead, which opens the file
chooser without fighting the overlay:

```
browser_evaluate  → target: <the file input ref>, function: (element) => element.click()
browser_file_upload → paths: ["/absolute/path/resume.pdf"]
```

**Selecting Disability status reveals two more required fields.** A Name and a Date (`MM/DD/YYYY`)
appear underneath the EEO block only after the dropdown is set, and they are required once it is.
They are absent from the first snapshot, so re-snapshot after setting disability status and fill
them before considering the form complete.

**Dismiss the cookie banner first** — Deny works — since it overlays the form on first load.

## Workday specifics

**Verified on Zillow, 2026-08-18.** An earlier version of this file claimed Workday was "not
stageable unattended". That was written from assumption and it was wrong. The flow works end to end.

**An account is required, one per employer.** Workday tenants are separate, so a login at one
company does nothing at another. Account creation needs an email, a password (8+ chars with upper,
lower, numeric and special), and a privacy checkbox, then an emailed activation link.

**Never invent, generate, or store a password.** Ask the user to create one in their password
manager and record only the pointer in the `accounts` block in `the profile tables` — that file names which accounts exist
and where each password lives, never the password itself.

The activation link is single-use: opening it after the user has already clicked it returns "Invalid
Token". That is harmless. Just sign in normally.

**Apply Manually** on the job page starts a five-step flow: My Information, My Experience,
Application Questions, Voluntary Disclosures, Review. `Save and Continue` advances a step and does
not submit; only the `Submit` button on step 5 does. Each step takes a few seconds to render, so wait
before snapshotting.

**Required fields appear mid-flow.** "Are you a previous employee?" only surfaced as a validation
error after the first `Save and Continue`. Read the Errors Found panel rather than assuming the page
was complete.

**Work Experience, Education and Skills are optional** when a resume is attached. They were left
empty on Zillow. Fill them if a structured ATS record matters for a given employer.

**This form carries a bot honeypot** — a hidden input labelled "for robots only, do not enter if
you're human". Leave it empty.

## Submitting

Phase 5 only, and only for applications the user named.

```
browser_click → the submit button
browser_wait_for → confirmation text
browser_snapshot
```

A confirmation reads like "Thank you for applying" or "Application received", usually with the page
replaced. **Validation errors mean nothing was submitted** — the page stays, with messages against
the offending fields. Repair those fields and re-present the application for approval; do not
resubmit silently.

Set `applied` only against a confirmation you have seen in a snapshot.

## Traps

- **Application limits.** Cohere states 5 per 90 days; Deepgram states 2 per 60 days across a shared
  limit group. **These no longer gate anything** — the limits table in `the profile tables` is a record,
  not a budget. Add to it whenever a form declares one, and note in the run entry when an application
  goes out past a stated limit, so the history shows it.
- **Published salary ranges.** Ashby prints the range on the posting — Deepgram's reads
  $180K–$240K. Read it before answering any compensation field and apply the compensation rule in
  `the profile tables`. Answering the $120,000 floor against a published $180K–$240K band anchors the
  negotiation about sixty thousand dollars below where the employer opened it.
- **Cover letter fields** are usually optional. Leave optional essay fields empty rather than filling
  them with something generic; a weak answer costs more than no answer.
- **"How did you hear about us?"** — answer the company's job board, which is true.
- **Duplicate applications.** Check `$Q "SELECT * FROM prospects WHERE key='…'"` before staging. A second application to
  the same role reads as carelessness and can burn a limit.
- **Login walls.** Some forms require an account before showing fields. Flag for the user.
- **Stale refs.** Any click that re-renders invalidates every ref in the snapshot. Re-snapshot.
