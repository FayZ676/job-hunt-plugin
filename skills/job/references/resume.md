# Resume writing

Phase 3 of `/job` in detail: turning `career/profile.json` into a one-page PDF targeted at one job
description, with a PDF alongside it.

**The deliverable is the `.pdf`.** Never hand back a markdown resume. The `.json`
spec written along the way is a build input.

| Purpose | Path |
| ------- | ---- |
| Only content source | `career/profile.json` |
| Output directory | `career/resumes/` |
| Moved here once submitted | `career/resumes/submitted/` |
| Section order | **Section order and content**, below |
| Spec format | **Spec format**, below |
| Recurring defects to avoid | `career/resume-patterns.md` |

`career/profile.json` is the only source. Its `## Profile` section supplies the header block and
Education verbatim; everything below it is content to select against the JD. Never mine an existing
resume for bullet text — the copies in circulation carry the errors listed under Facts.

## Process

1. Take the JD from the day's `career/.state/scans/<date>.json`, or as pasted text, a file path,
   or a URL. Given only a company and title, ask for the posting text.
2. Extract its hard requirements, day-to-day responsibilities, and implied signals.
3. Read `career/profile.json` in full and score each project on overlap with those requirements. Write
   the mapping down before drafting; it decides ordering and cuts.
4. Select: roles reverse-chronological, most-relevant project first within each role. Cut irrelevant
   projects entirely. A role with nothing relevant gets one summary bullet.
5. Draft against Writing below, then test every line against The one-pass test.
6. Write the spec to `career/resumes/<company>-<role-slug>.json`.
7. Build, then look at the rendered page.
8. Report gaps: JD requirements with no evidence in `career/profile.json`; bullets a missing number would
   strengthen, named specifically; close-call cuts.

## Writing

Plain professional English. The reader passes over each line once, at speed, and takes a fact away
from it.

- **One idea per bullet, one sentence, under ~30 words.** `career/profile.json` packs three ideas into a
  bullet because it is a reference document. Split them.
- **Name what was built and what it does.** Every noun phrase must be concrete enough to picture. A
  phrase that could describe ten different systems is unfinished.
- **Real numbers only, from `career/profile.json`.** Never invent, round up, or extrapolate. Empty
  `Numbers:` fields are not an invitation to fill them. A bullet with no number is fine — flag it in
  the gap report.
- **Mirror the JD's vocabulary where it is honest.** Their "evaluation harness" over the file's
  "accuracy harness". Never blur scikit-learn into PyTorch.
- **Match the verb to the work's real status.** "Shipped", "automated" and "replaced" assert that an
  outcome already happened. Use "built" for work that exists and is not yet live, and check the
  project's status line in `career/profile.json` before choosing. A projected number is not a number —
  never print one.
- **One judgment call per role**, written as the decision and its consequence: "enforced through the
  boto3 event system, so every service inherits the protection automatically."
- **Every adjective and adverb must do work.** "Roughly" and "about" hedge a real estimate and stay.
  "Actually", "real", "honest", "surprisingly", "messy" decorate and go. If a modifier can be deleted
  without losing information, delete it.

### Choose the strongest word that is exactly true

Plain is not drab. The one-pass test rejects decoration and keeps precision — so where two words are
equally honest, take the more specific one, and prefer the verb that names the value created over the
verb that names the chore.

| Flat | Sharper |
| ---- | ------- |
| backfilled 50,000 presentations | **enriched** 50,000 presentations |
| added request tracing and structured logs | **instrumented** the services |
| added the recovery paths | **hardened** it against vendor failures |
| kept the two stages independent | **decoupled** the stages |
| added a pluggable retriever layer | **designed** a pluggable retriever layer |
| wrote a provider-agnostic interface over two vendors | **abstracted** two vendors behind one interface |
| assembled evaluation sets | **curated** evaluation sets |

One test catches both failures: **does the word carry information the alternative lacks?**
"Enriched" says the dataset gained value where "backfilled" only says a gap was filled — it earns the
swap. "Bake-off" carries nothing "benchmark" does not; it draws attention to itself, so it fails from
the opposite side.

### The one-pass test

Rewrite any line matching a row below. Each row is a real defect from a shipped resume.

| Reject | Because | Instead |
| ------ | ------- | ------- |
| "AI engineer who ships LLM product surfaces and the evals that keep them honest" | Identity claim with no fact in it; raises questions | "Four years building production LLM systems end to end: retrieval and agent pipelines over financial documents, and the evaluation that gates them in CI" |
| "Caught Claude answering accurately about an annual report that was never in the retrieved context" | Story with the candidate as protagonist; the reader wants the system | "Built evaluation sets from documents outside the model's training data, so scores measure retrieval quality" |
| "Ran a retriever bake-off"; "two model hops"; "an honest 429" | Slang, insider shorthand, editorializing | "Benchmarked five retrievers across chunk sizes and values of k" |
| "Instrumented the platform for the failure modes production actually has" | Abstract enough to mean anything | "Added per-request IDs, structured logs and processing-time headers to the FastAPI services" |
| "Judged caption fine-tunes by human review, holding automated scoring for the tasks where real ground truth existed, and moderated in two layers: …" | Two unrelated ideas in one sentence; forces a second pass | Two bullets, one idea each |
| "made FAISS a config choice rather than a rewrite"; "not just…"; "no separate app to adopt" | Names what the candidate did not do | "a pluggable retriever layer where FAISS, kNN and TF-IDF are a configuration setting" |

Also: at most one em dash or colon per bullet; no "actually", "real", "honest", "surprisingly",
"messy"; vary the opening verb across consecutive bullets.

The summary follows the same test — facts, and no self-description. Years, what he builds, where, and
the prior role. Skip it when it would only restate the bullets.

## Facts

**`career/profile.json` is the only source of truth for a number, a title, or a date.** An older resume,
a LinkedIn profile, or a previously generated bullet is not evidence — those are exactly where
inflated figures survive.

Keep a `## Facts` section at the bottom of `career/profile.json` for corrections that keep resurfacing:
a title that gets upgraded by mistake, a metric that gets rounded up, a project that was
discontinued but still reads as live, work that was shared and must not be claimed solo. Read that
section before writing bullets and never contradict it.

Three rules that hold regardless of what any file says:

- **A number goes on the resume only if it appears in `career/profile.json`.** No estimating, no
  rounding up, no "over N" where N was never measured.
- **Shared work is described as shared.** "Built with one other engineer" costs nothing and is true.
- **Discontinued and in-progress work is labeled.** A shipped project and an abandoned one do not
  read the same way, and the difference is checkable.

## Build

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/render.py" career/resumes/<slug>.json career/resumes/<slug>.pdf --density tight
pdfinfo career/resumes/<slug>.pdf | grep Pages
pdftoppm -jpeg -r 95 career/resumes/<slug>.pdf /tmp/page   # then Read /tmp/page-1.jpg
```

`render.py` owns all formatting. If the layout needs to change, change `render.py` so every future
resume inherits it. It parses `**bold**` and `[label](url)` only — backticks render literally.

**Always read the rendered image.** Page count alone misses an orphaned two-line section or a Skills
block that ate the bottom third. Target one page filled to roughly the bottom margin: more than
~0.75in of blank foot means content was left out, so add the next-most-relevant project.

**A page with visible blank space at the foot is not finished, and one page is not the goal — one
*full* page is** (observed on builds that shipped with
roughly an inch of dead space before he called it). Blank space is unused selection budget: there is
always another real bullet in `career/profile.json`, another Personal Projects line, or the Publications
paragraph that could be earning that room. Iterate — add the next-most-relevant content, rebuild, look
again, and trim back only if it spills to a second page. Expect two or three build cycles; stopping at
the first one that fits on a page is what produces the defect. Two pages
only for a senior, staff, or research JD, and then filled.

To fit, in order: `--density tight` (`normal` and `roomy` exist for shorter content); cut the least
relevant bullets; tighten wording so bullets stop before wrapping one word onto a new line; margins
in the spec, never below 0.4in.

Requires Typst and Poppler.

## After

Record the `.pdf` path on the prospect (`UPDATE prospects SET resume=…`), then give the gap
report. `career/resumes/` therefore holds only resumes that have not gone out yet; phase 5 moves a
resume into `career/resumes/submitted/` when its application is submitted, so the top level stays a
worklist. Offer, without doing: a matching cover letter, and appending anything newly surfaced
to `career/profile.json`.

---

## Section order and content

Section order for the spec's `sections` array. Omit any section the JD makes irrelevant, except
Experience and Education. The JSON shape of each section is in `spec-schema.md`.

### Summary — `paragraph`

Two or three lines of fact, never a self-description. **Open with the total years** — the largest
honest number goes first. Then the two or three specifics this JD cares about, then what he did
before, stated as work he performed rather than a product that happened to exist.

> Four years building production AI systems, most of it on the infrastructure under LLM products:
> evaluation that runs in CI, guardrails enforced inside the AWS SDK, and Postgres-backed retrieval
> and job services other teams now build on. Earlier, built the GCP backend behind an AI app with
> 10,000 users.

A rounded total opens better than a hedged per-employer figure even
though the latter names the employer — a reader filtering on experience may discard him before
reaching the end of the sentence, so the smaller number must not come first. The employer is already
visible in Experience directly below.

Banned here as everywhere: "end to end" and other filler that survives deletion; "gates it in CI"
when "catches regressions before release" says it plainly.

Skip the section when it would only restate the bullets; a weak summary costs two bullets' worth of
space.

### Experience — `experience`

Roles in reverse-chronological order:

| title | company | dates |
|---|---|---|
| Machine Learning Engineer | Northwind Analytics | November 2023 – Present |
| Co-Founder & Lead Developer | Kestrel Labs | July 2022 – September 2023 |
| Research Assistant | State University | May 2022 – January 2023 |

Bullets: one idea each, one sentence, under ~30 words, a number only if a real one exists in
`career/profile.json`. 3–8 per role, ordered by relevance to the JD. A role with no relevant projects gets a single summary
bullet, not a full list.

### Projects — `bullets`

Only when an independent project maps to the JD better than a work
project it would displace. Mark status honestly: discontinued / in progress.

### Publications — `paragraph`

Only when the JD is research-adjacent:

> First author, biomedical information extraction for COVID-19 fake news detection. Big Data and
> Cognitive Computing 2023, 7(1), 46 — Editor's Choice. https://www.mdpi.com/2504-2289/7/1/46

### Education — `entries`

| primary | secondary |
|---|---|
| BS Computer Science | State University, May 2022 |
| Associate of Science | Community College, May 2020 |

### Skills — `labeled`

Labels: Languages, Frameworks, AI/ML, Cloud & Data, Delivery. Drop a label entirely rather than pad
it. Drawn from the selected bullets plus the JD's named technologies the candidate actually has — no
aspirational entries, no soft skills.

### Notes

- The publication title in `career/profile.json` is recorded only by URL; fetch or confirm the exact
  title and author list before printing a citation.
- Keep the contact line identical to the `## Profile` section of `career/profile.json` — it is the
  canonical header. Same for Education.

---

## Spec format (input to `render.py`)

The spec is the resume's content. `render.py` owns every formatting decision, so the spec carries no
styling: no font sizes, no spacing, no bold-for-emphasis except the inline `**…**` noted below.

Write it to `career/resumes/<company>-<role-slug>.json`, then build. Keeping the spec next to the `.pdf`
is what makes a later tweak a one-line edit and a rebuild rather than a fresh generation.

### Shape

```json
{
  "name": "Ada Lovelace",
  "contact": [
    "Denver, CO 80202",
    "ada@example.com",
    { "text": "linkedin.com/in/ada-lovelace", "link": "https://www.linkedin.com/in/ada-lovelace/" }
  ],
  "sections": [ ... ]
}
```

Optional top-level keys: `font` (default `Calibri`), `margins` (`{top,bottom,left,right}` in inches,
defaults 0.5 / 0.5 / 0.7 / 0.7).

Contact entries are joined with `|`. A plain string renders as text; `{text, link}` renders as a
hyperlink.

### Section types

Every section is `{ "heading": "...", "type": "...", ... }`. The heading renders uppercase, bold,
with a full-width rule under it. Order the sections as they should appear.

| `type` | Payload | Renders as |
|---|---|---|
| `paragraph` | `"text": "..."` | One flowing paragraph. Use for Summary and Publications. |
| `experience` | `"roles": [{title, company, dates, bullets[]}]` | `**Title, Company** — Dates` then a bulleted list. |
| `bullets` | `"items": ["...", "..."]` | A bare bulleted list, no role header. |
| `labeled` | `"items": [{label, text}]` | `**Label:** text`, one line each. Use for Skills. |
| `entries` | `"items": [{primary, secondary}]` | `**Primary** — Secondary`, one line each. Use for Education. |

### Inline formatting

Inside any `text` or bullet string: `**bold**`, `[label](url)`, and bare `https://…` URLs become a
hyperlink. Nothing else is parsed — no italics markers, no literal `•`, no `\n` (split into separate
items instead).

### Building

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/render.py" <spec.json> [out.pdf] [--density tight|normal|roomy] [--keep-typ]
```

`--density` is the one-page lever: `normal` is the default, `tight` shaves font size and spacing,
`roomy` opens it up when the content is short and the page looks sparse. Change density before you
start cutting content, and cut content before you change margins.
