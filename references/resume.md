# Resume writing

Phase 3 in detail: turning the profile tables into a one-page PDF targeted at one job description.
This file is the whole guide — what may go on a resume, how it is written, what to check before it
ships, and the spec `resume.py` builds from.

**The deliverable is the `.pdf`.** Never hand back a markdown resume; the `.json` spec written along
the way is a build input, kept next to the PDF so a later tweak is an edit and a rebuild.

## Contents

- Sources and restrictions — what may become a claim, and what may never
- Process — JD in, mapping, selection, draft, build, gap report
- Writing — bullet rules, word choice, the one-pass test
- Check on every build — the list every defect that shipped turned into
- The shape to start from — the structure of the strongest build so far
- What the market asks for — measured across 112 real JDs
- Build — `resume.py build`, and reading the rendered page
- The spec — what belongs in each section (`resume.py spec` owns the format)

## Sources and restrictions

**The profile tables are the only source.** `profile` supplies the header block and `education` the
Education section, verbatim. Bullets come only from `project_bullets`, numbers only from
`project_metrics`.

- **Never mine an existing resume for bullet text.** The copies in circulation carry exactly the
  errors `facts` exists to correct. Read `facts` before writing and never contradict it.
- **A number goes on the resume only if it is in `project_metrics`** — no estimating, no rounding up,
  no "over N" where N was never measured. A duration implied by a date range is a number too.
- **Shared work is described as shared.** `projects.shared_with` says which; "built with one other
  engineer" costs nothing and is true. Work done alone stays unqualified.
- **Discontinued and in-progress work is labeled**, per `projects.status`. A shipped project and an
  abandoned one do not read the same way, and the difference is checkable.
- **Singular evidence stays singular.** One package adopted by one team is not "other teams".
- **Verify a tool claim against the repo, not against memory.** A build once named a library that had
  been removed from the project months earlier.

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

Plain professional English. The first pass is 6–10 seconds: the reader passes over each line once, at
speed, and takes a fact away.

- **One idea per bullet, one sentence, ~25 words and never over 30.** The tables pack several ideas
  into a row because they are a reference. Split them. Long bullets are this skill's standing habit —
  a measured median of 37 words against a convention of 15–25.
- **Outcome first.** The payload belongs in the first six words, the stack and technique after it.
- **Name what was built and what it does.** Every noun phrase must be concrete enough to picture. A
  phrase that could describe ten different systems is unfinished.
- **Real numbers only, from `project_metrics`.** A bullet with no number is fine — flag it in the gap
  report.
- **Mirror the JD's vocabulary where it is honest.** Their "evaluation harness" over the tables'
  "accuracy harness". Never blur scikit-learn into PyTorch.
- **Match the verb to the work's real status.** "Shipped", "automated" and "replaced" assert that an
  outcome already happened; use "built" for work that exists and is not yet live. Check
  `projects.status` first. A projected number is not a number — never print one.
- **One judgment call per role**, written as the decision and its consequence: "enforced through the
  boto3 event system, so every service inherits the protection automatically."
- **One collaboration bullet per role** where the tables support one — cross-functional work,
  mentoring, directing contractors, a client engagement. Nearly half the market asks for it and early
  builds had none at all.
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

## Check on every build

Each of these is a defect that reached a built resume, two of them a submitted one.

1. **Every number in the summary traces to a row**, durations included. The summary is written last
   and freely, and is where the one fabricated figure — "three years" for a 14-month tenure — was
   generated.
2. **Every shared project carries its qualifier**, per `projects.shared_with`. This is the defect
   that drifts most: present in three specs of seven, absent in four already submitted.
3. **No plural where the evidence is singular.**
4. **The page is full.** Fitting on one page is the constraint, not the target. More than ~0.75in of
   blank foot means content was left out — blank space is unused selection budget.
5. **The rendered image was looked at**, not just the page count.

## The shape to start from

The strongest build to date got five things right at once. Start from this structure, then select
content for the JD:

1. **A Personal Projects section led by a shipped, linked product.** For AI roles, independent
   shipping is the strongest signal available at this tenure, and three years of resumes carried none.
2. **GitHub in the header**, inherited by every build.
3. **A summary built on shipped work**, not identity claims.
4. **Depth on two bullets rather than breadth on six.** Cutting two thin bullets to hold one page is
   the right trade.
5. **The frameworks list ordered by real strength**, strongest stack first.

Format, on which every credible source agrees: plain single-column, no graphics, standard font, PDF,
one page at this experience level, Education last. Decoration costs scan speed with no upside.
Resume-builder sites cite invented statistics — never tune a resume against them.

## What the market asks for

Measured across the 112 job descriptions the filters kept in the first scanning fortnight — better
evidence than any listicle, and reproducible against `prospects` at any time.

- **Lead with ship/shipped (84%), RAG (80%), agent (70%), eval (68%), LLM and production (62%).**
  That vocabulary matches most postings; mirror it wherever it is honest.
- **Named products are detail, not headline.** Bedrock appears in 1 posting of 112, FastAPI in 2,
  Terraform in 4. Generic "AWS" (44%) carries the signal; house names belong in Skills, where they
  cost nothing.
- **Collaboration is asked for as often as the technical terms** — stakeholder 46%, ambiguity 37%,
  mentor 22% — and is the easiest thing for a bullet set of solo builds to miss.
- **Production evidence beats model trivia.** Prompt engineering alone (30%) reads thin; tied to
  retrieval, evaluation, or a shipped feature it reads senior.

## Build

```bash
python3 "$HOME/.claude/skills/job/scripts/phases/resume.py" build "$CAREER/resumes/<slug>.json" --key <key> --density tight
pdftoppm -jpeg -r 95 "$CAREER/resumes/<slug>.pdf" /tmp/page   # then read /tmp/page-1.jpg
```

`resume.py` owns all formatting and requires Typst and Poppler. If the layout needs to change, change
`resume.py` so every future resume inherits it. It parses `**bold**` and `[label](url)` only —
backticks render literally.

**Always read the rendered image, and aim for one *full* page.** Page count alone misses an orphaned
two-line section or a Skills block that ate the bottom third. Where there is a visible gap above the
bottom margin, add the next-most-relevant content — another real bullet, a Personal Projects line,
the Publications paragraph — rebuild, and look again. Expect two or three cycles. Two pages only for
a senior, staff, or research JD, and then filled.

To fit, in order: `--density tight` (`normal` and `roomy` exist for shorter content); cut the least
relevant bullets; tighten wording so bullets stop before wrapping one word onto a new line; margins
in the spec, never below 0.4in.

`--key` records the absolute path on the prospect as part of the build; without it the PDF is written
and nothing is recorded. Then give the gap report. Phase 5 moves the files into `submitted/`, so
`$CAREER/resumes/` stays a worklist of resumes that have not gone out.
Offer, without doing: a matching cover letter, and writing anything newly surfaced back into the
profile tables.

## The spec

**`resume.py spec` prints the contract** — top-level keys, contact entries, the inline markup, and
every section type with its payload. Read it there; this file covers only what belongs in each
section. Write the spec to `$CAREER/resumes/<company>-<role-slug>.json`.

Emit sections in this order, omitting any the JD makes irrelevant except Experience and Education.

| Section | Type | What goes in it |
|---|---|---|
| Summary | `paragraph` | Two or three lines of fact, never self-description. **Opens with the total years** — see below. Skip it when it would only restate the bullets; a weak summary costs two bullets' worth of space |
| Experience | `experience` | Reverse-chronological. 3–8 bullets per role, ordered by relevance to the JD |
| Projects | `bullets` | Only when an independent project maps to the JD better than the work project it would displace. Mark status honestly: discontinued / in progress |
| Publications | `paragraph` | Only when the JD is research-adjacent. `project_links` records the paper by URL only — confirm the exact title and author list before printing a citation |
| Education | `entries` | From the `education` table, verbatim: `{"primary": "BS Computer Science", "secondary": "State University, May 2022"}` |
| Skills | `labeled` | Labels: Languages, Frameworks, AI/ML, Cloud & Data, Delivery. Drop a label rather than pad it. Drawn from the selected bullets plus the JD's named technologies that appear in `project_technologies` — no aspirational entries, no soft skills |

**Keep the contact line identical to the `profile` table** — it is the canonical header.

**The summary opens with the total years** — the largest honest number goes first, because a reader
filtering on experience may discard the candidate before reaching the end of the sentence. Then the
two or three specifics this JD cares about, then what came before, stated as work performed.

> Four years building production AI systems, most of it on the infrastructure under LLM products:
> evaluation that runs in CI, guardrails enforced inside the AWS SDK, and Postgres-backed retrieval
> and job services other teams now build on. Earlier, built the GCP backend behind an AI app with
> 10,000 users.

Banned here as everywhere: filler that survives deletion ("end to end"), and jargon where plain
English is shorter ("catches regressions before release", not "gates it in CI").
