# Resume writing

Phase 3 in detail: turning the profile tables into a one-page PDF targeted at one job description.

**The deliverable is the `.pdf`.** Never hand back a markdown resume; the `.json` spec written along
the way is a build input, kept next to the PDF so a later tweak is an edit and a rebuild.

**The profile tables are the only source.** `profile` supplies the header block and `education` the
Education section, verbatim. Bullets may come only from `project_bullets`, numbers only from
`project_metrics`. **Never mine an existing resume for bullet text** — the copies in circulation
carry exactly the errors `facts` exists to correct.

Recurring defects that have actually shipped are logged in `references/resume-patterns.md`.
Read it before building — it is the record of mistakes this skill has already made.

## Process

1. Get the JD: a `prospects.description`, pasted text, a file path, or a URL. Given only a company
   and title, ask for the posting text.
2. Extract its hard requirements, day-to-day responsibilities, and implied signals.
3. Read the profile tables and score each project on overlap. Write the mapping down before
   drafting; it decides ordering and cuts.

   ```sql
   SELECT e.name AS employer, p.name AS project, b.text
   FROM project_bullets b
   JOIN projects p ON p.id = b.project_id
   JOIN employers e ON e.id = p.employer_id
   ORDER BY e.seq, p.seq, b.seq;
   ```

4. Select: roles reverse-chronological, most relevant project first within each role. Cut irrelevant
   projects entirely. A role with nothing relevant gets one summary bullet.
5. Draft against **Writing**, then test every line against **The one-pass test**.
6. Write the spec to `$CAREER/resumes/<company>-<role-slug>.json`, build, and look at the page.
7. Report gaps: JD requirements with no evidence in the tables; bullets a missing number would
   strengthen, named specifically; close-call cuts.

## Writing

Plain professional English. The reader passes over each line once, at speed, and takes a fact away.

- **One idea per bullet, one sentence, under ~30 words.** The tables pack several ideas into a row
  because they are a reference. Split them.
- **Name what was built and what it does.** Every noun phrase must be concrete enough to picture. A
  phrase that could describe ten different systems is unfinished.
- **Real numbers only, from `project_metrics`.** Never invent, round up, or extrapolate. A bullet
  with no number is fine — flag it in the gap report.
- **Mirror the JD's vocabulary where it is honest.** Their "evaluation harness" over the tables'
  "accuracy harness". Never blur scikit-learn into PyTorch.
- **Match the verb to the work's real status.** "Shipped", "automated" and "replaced" assert that an
  outcome already happened; use "built" for work that exists and is not yet live. Check
  `projects.status` before choosing. A projected number is not a number — never print one.
- **One judgment call per role**, written as the decision and its consequence: "enforced through the
  boto3 event system, so every service inherits the protection automatically."
- **Every adjective and adverb must do work.** "Roughly" and "about" hedge a real estimate and stay.
  "Actually", "real", "honest", "surprisingly", "messy" decorate and go. If a modifier can be deleted
  without losing information, delete it.

### Choose the strongest word that is exactly true

Plain is not drab. Where two words are equally honest, take the more specific one, and prefer the
verb that names the value created over the verb that names the chore.

| Flat | Sharper |
| ---- | ------- |
| backfilled 50,000 presentations | **enriched** 50,000 presentations |
| added request tracing and structured logs | **instrumented** the services |
| added the recovery paths | **hardened** it against vendor failures |
| kept the two stages independent | **decoupled** the stages |
| wrote a provider-agnostic interface over two vendors | **abstracted** two vendors behind one interface |
| assembled evaluation sets | **curated** evaluation sets |

One test catches both failures: **does the word carry information the alternative lacks?**
"Enriched" says the dataset gained value where "backfilled" only says a gap was filled — it earns the
swap. "Bake-off" carries nothing "benchmark" does not, and draws attention to itself; it fails from
the opposite side.

### The one-pass test

Rewrite any line matching a row below. Each row is a real defect from a shipped resume.

| Reject | Because | Instead |
| ------ | ------- | ------- |
| "AI engineer who ships LLM product surfaces and the evals that keep them honest" | Identity claim with no fact in it | "Four years building production LLM systems: retrieval and agent pipelines over financial documents, and the evaluation that gates them in CI" |
| "Caught Claude answering accurately about an annual report that was never in the retrieved context" | Story with the candidate as protagonist; the reader wants the system | "Built evaluation sets from documents outside the model's training data, so scores measure retrieval quality" |
| "Ran a retriever bake-off"; "two model hops"; "an honest 429" | Slang, insider shorthand, editorializing | "Benchmarked five retrievers across chunk sizes and values of k" |
| "Instrumented the platform for the failure modes production actually has" | Abstract enough to mean anything | "Added per-request IDs, structured logs and processing-time headers to the FastAPI services" |
| "Judged caption fine-tunes by human review, holding automated scoring for the tasks where real ground truth existed, and moderated in two layers: …" | Two unrelated ideas in one sentence; forces a second pass | Two bullets, one idea each |
| "made FAISS a config choice rather than a rewrite"; "not just…"; "no separate app to adopt" | Names what the candidate did not do | "a pluggable retriever layer where FAISS, kNN and TF-IDF are a configuration setting" |

Also: at most one em dash or colon per bullet; vary the opening verb across consecutive bullets.

## Facts

**The profile tables are the only source of truth for a number, a title, or a date.** An older
resume, a LinkedIn profile, or a previously generated bullet is not evidence — those are exactly
where inflated figures survive. Read `facts` before writing bullets and never contradict it; it
holds the corrections that keep resurfacing.

- **A number goes on the resume only if it is in `project_metrics`.** No estimating, no rounding up,
  no "over N" where N was never measured.
- **Shared work is described as shared.** `projects.shared_with` says so; "built with one other
  engineer" costs nothing and is true.
- **Discontinued and in-progress work is labeled**, per `projects.status`. A shipped project and an
  abandoned one do not read the same way, and the difference is checkable.

## Build

```bash
python3 "$HOME/.claude/skills/job/scripts/render.py" "$CAREER/resumes/<slug>.json" "$CAREER/resumes/<slug>.pdf" --density tight
pdftoppm -jpeg -r 95 "$CAREER/resumes/<slug>.pdf" /tmp/page   # then read /tmp/page-1.jpg
```

`render.py` owns all formatting. If the layout needs to change, change `render.py` so every future
resume inherits it. It parses `**bold**` and `[label](url)` only — backticks render literally.
Requires Typst and Poppler.

**Always read the rendered image, and aim for one *full* page.** Page count alone misses an orphaned
two-line section or a Skills block that ate the bottom third. More than ~0.75in of blank foot means
content was left out: blank space is unused selection budget, and there is always another real
bullet, another Personal Projects line, or the Publications paragraph that could be earning that
room. Add the next-most-relevant content, rebuild, look again, and trim back only if it spills.
Expect two or three cycles — stopping at the first build that fits on a page is what produces the
defect. Two pages only for a senior, staff, or research JD, and then filled.

To fit, in order: `--density tight` (`normal` and `roomy` exist for shorter content); cut the least
relevant bullets; tighten wording so bullets stop before wrapping one word onto a new line; margins
in the spec, never below 0.4in.

## After

Record the path (`UPDATE prospects SET resume=…`), then give the gap report. `$CAREER/resumes/`
therefore holds only resumes that have not gone out yet; Phase 5 moves one into `submitted/` when its
application is submitted, so the top level stays a worklist. Offer, without doing: a matching cover
letter, and writing anything newly surfaced back into the profile tables.

---

## The spec

The spec is content only — `render.py` owns every formatting decision, so it carries no styling.
Write it to `$CAREER/resumes/<company>-<role-slug>.json`.

```json
{
  "name": "Ada Lovelace",
  "contact": [
    "Denver, CO 80202",
    "ada@example.com",
    { "text": "linkedin.com/in/ada-lovelace", "link": "https://www.linkedin.com/in/ada-lovelace/" }
  ],
  "sections": [ { "heading": "Summary", "type": "paragraph", "text": "…" } ]
}
```

Contact entries are joined with `|`; a plain string renders as text, `{text, link}` as a hyperlink.
**Keep the contact line identical to the `profile` table** — it is the canonical header. Optional
top-level keys: `font` (default `Calibri`) and `margins` (`{top,bottom,left,right}` in inches,
defaults 0.5 / 0.5 / 0.7 / 0.7).

Inside any `text` or bullet string: `**bold**`, `[label](url)`, and bare `https://…` become
hyperlinks. Nothing else is parsed — no italics, no literal `•`, no `\n` (split into separate items).

### Sections

Every section is `{heading, type, …}`. The heading renders uppercase, bold, with a full-width rule.
Emit them in this order, omitting any the JD makes irrelevant except Experience and Education.

| Section | `type` | Payload | What goes in it |
|---|---|---|---|
| Summary | `paragraph` | `"text"` | Two or three lines of fact, never self-description. **Open with the total years** — see below. Skip it when it would only restate the bullets; a weak summary costs two bullets' worth of space |
| Experience | `experience` | `"roles": [{title, company, dates, bullets[]}]` | Reverse-chronological. 3–8 bullets per role, ordered by relevance to the JD; one idea each, one sentence, under ~30 words. A role with no relevant projects gets a single summary bullet |
| Projects | `bullets` | `"items": ["…"]` | Only when an independent project maps to the JD better than a work project it would displace. Mark status honestly: discontinued / in progress |
| Publications | `paragraph` | `"text"` | Only when the JD is research-adjacent. `project_links` records the paper by URL only — confirm the exact title and author list before printing a citation |
| Education | `entries` | `"items": [{primary, secondary}]` | From the `education` table, verbatim: `{"primary": "BS Computer Science", "secondary": "State University, May 2022"}` |
| Skills | `labeled` | `"items": [{label, text}]` | Labels: Languages, Frameworks, AI/ML, Cloud & Data, Delivery. Drop a label entirely rather than pad it. Drawn from the selected bullets plus the JD's named technologies that appear in `project_technologies` — no aspirational entries, no soft skills |

`experience` renders as `**Title, Company** — Dates` then a bulleted list; `labeled` as `**Label:**
text`; `entries` as `**Primary** — Secondary`; `bullets` as a bare list with no header.

**The summary opens with the total years** — the largest honest number goes first, because a reader
filtering on experience may discard him before reaching the end of the sentence. Then the two or
three specifics this JD cares about, then what he did before, stated as work he performed.

> Four years building production AI systems, most of it on the infrastructure under LLM products:
> evaluation that runs in CI, guardrails enforced inside the AWS SDK, and Postgres-backed retrieval
> and job services other teams now build on. Earlier, built the GCP backend behind an AI app with
> 10,000 users.

Banned here as everywhere: filler that survives deletion ("end to end"), and jargon where plain
English is shorter ("catches regressions before release", not "gates it in CI").
