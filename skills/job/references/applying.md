# Application forms per ATS

Reaching, reading and filling a form with the Playwright MCP tools. Phase 4 fills; only Phase 5
submits.

## Reaching the form

| ATS | Apply URL | Notes |
| --- | --------- | ----- |
| **Ashby** | Job URL + `/application` | Renders client-side; wait, below |
| **Greenhouse** | `job-boards.greenhouse.io/<slug>/jobs/<id>` | Career pages embed this in an iframe. Go to the canonical URL, from the `gh_jid` in the prospect key |
| **Lever** | `jobs.lever.co/<slug>/<id>/apply` | Server-rendered and predictable, but **submission is gated by hCaptcha** |
| **Workday** | `<company>.wd<N>.myworkdayjobs.com/…` | **Fully drivable.** Needs a per-employer account, then a five-step flow |
| **iCIMS, Taleo, SmartRecruiters** | varies | Untested. Do not assume they are blocked — try one before writing them off |
| **Harvested** (`indeed:`) | `indeed.com/applystart?jk=<jobkey>&from=vj` | Redirects to the employer's real application page. Resolve it, then follow the row above for whatever ATS you land on |

The prospect `key` prefix names the ATS: `ashby:`, `greenhouse:`, `lever:`, `manual:`, `indeed:`.

**A harvested posting is applied to through the employer's ATS, never through the aggregator.**
Record the resolved URL as the application's `url`, not the listing link. When it resolves to
Greenhouse, Lever or Ashby, `INSERT` the company into `companies` — found once by hand, fetched from
its own board every morning after, at which point ingest upgrades the prospect to the board's copy on
its own.

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

**Yes/No appears as two shapes, and only the snapshot tells them apart.** Some forms render them as
`radio` elements, which `browser_fill_form` sets by label; others render `button "Yes"` / `button
"No"` pairs, which need `browser_click` and ignore `fill_form` entirely. Read the element type first.

**Location fields are typeaheads.** Ashby's `Location*` is a combobox with a `Start typing…`
placeholder:

```
browser_type  → target: <combobox ref>, text: "Denver", slowly: true
browser_click → the matching option
```

The dropdown renders as a `listbox` **detached at the very end of the snapshot**, outside the form
container. The first option is highlighted but **not committed until clicked** — confirm by
re-snapshotting: the combobox should read `Denver, Colorado, United States`, not `Denver`.

**Refs go stale after every interaction.** Clicking an option renumbers refs elsewhere on the page
(sponsorship buttons moved `e138/e139` → `e390/e391` after one typeahead selection). Snapshot
immediately before each click. A stale ref errors rather than misclicking, so this costs a retry
instead of a wrong answer.

**Resume upload** needs the file chooser triggered first, and absolute paths only. Attach the
tailored PDF for that role, never a generic one.

```
browser_click       → the "Upload File" button
browser_file_upload → paths: ["/absolute/path/to/resume.pdf"]
```

**Skip "Autofill from resume."** It parses the PDF and populates fields with values that then have to
be audited, which costs more than filling them explicitly from the profile.

## Before you stop

Re-snapshot and check every required field — marked `*` — holds a value. The silent failures are an
uncommitted typeahead, a radio group that looks answered because one option is visible, and a file
input that never received the upload.

Screenshot the completed form into `career/resumes/`; that screenshot is what the user reviews.

**Then stop.** Do not click Submit, Apply, Continue, or Next in Phase 4. On a multi-page form, stop
at the end of the first page and record the page count.

## Lever specifics

**hCaptcha gates the submit button.** Every field filled and the resume attached, and clicking
"Submit application" re-triggers a nine-image challenge instead of submitting.

**Never attempt the challenge.** A captcha is an explicit request for a person. Fill the form, save
the staged record, and hand the open tab to the user to finish — on a Lever posting, Phase 5 means
*they* click submit.

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

**An account is required, one per employer** — tenants are separate, so a login at one company does
nothing at another. Creation needs an email, a password (8+ chars, mixed case, numeric, special) and
a privacy checkbox, then an emailed activation link. That link is single-use; opening it after the
user already clicked it returns "Invalid Token", which is harmless — just sign in.

**Never invent, generate, or store a password.** Ask the user to create one in their password
manager, and record only the pointer in the `accounts` table — which accounts exist and where each
password lives, never the password.

**Apply Manually** starts five steps: My Information, My Experience, Application Questions, Voluntary
Disclosures, Review. `Save and Continue` advances and does not submit; only `Submit` on step 5 does.
Each step takes a few seconds to render, so wait before snapshotting.

**Required fields appear mid-flow** — "Are you a previous employee?" only surfaced as a validation
error after the first `Save and Continue`. Read the Errors Found panel rather than assuming the page
was complete. **Work Experience, Education and Skills are optional** when a resume is attached. **The
form carries a bot honeypot** — a hidden input labelled "for robots only" — leave it empty.

## Submitting

Phase 5 only, and only for applications the user named.

```
browser_click    → the submit button
browser_wait_for → confirmation text
browser_snapshot
```

A confirmation reads like "Thank you for applying" or "Application received", usually with the page
replaced. **Validation errors mean nothing was submitted** — the page stays, with messages against
the offending fields. Repair those and re-present the application for approval; never resubmit
silently. Set `applied` only against a confirmation you have seen in a snapshot.

## Traps

- **Published salary ranges.** Ashby prints the band on the posting. Read it before answering any
  compensation field: answering a $120,000 floor against a published $180K–$240K band anchors the
  negotiation sixty thousand dollars below where the employer opened it.
- **Application limits.** Some companies state them ("5 per 90 days"). `company_limits` is a record,
  not a budget — add to it whenever a form declares one, and note it in the run entry when an
  application goes out past a stated limit.
- **Cover letter fields** are usually optional. Leave optional essay fields empty rather than filling
  them with something generic; a weak answer costs more than no answer.
- **"How did you hear about us?"** — answer the company's job board, which is true.
- **Login walls.** Some forms require an account before showing fields. Flag for the user. Indeed
  Apply (`indeedApplyEnabled` with no company site) is one of these — an in-platform form needing a
  signed-in account; stage what is reachable and flag the rest.
