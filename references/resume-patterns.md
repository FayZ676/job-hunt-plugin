# What successful resumes do — research notes, 2026-08-15

> **Layout note.** Entries below predate the database. Where they cite `career/index.md`,
> `career/jobs/*.json` or a `career/`-relative path, that content now lives in tables in
> `$CAREER/.state/job.db` — `profile`, `facts`, `experience`, `projects`, `project_bullets`,
> `project_metrics`. The defects and the rules drawn from them still stand; only the storage
> moved. Read them as history, not as paths to open.

Research pass on how other people in Faizi's position structure and phrase resumes, plus what that
implies for the ones `/job` produces. Read this alongside `references/resume.md`.

## First, the evidence problem

**A resume posted publicly is almost never a *verified* successful one.** The searches for real
artifacts hit walls:

- **onsites.fyi** — claims the largest curated collection (175 FAANG resumes), filterable by track and
  level. Behind a Premium paywall; nothing readable without paying.
- **IGotAnOffer** ("11+ real FAANG resumes that worked", "6 ML engineer resume examples") — returns
  403 to a plain fetch.
- **r/EngineeringResumes wiki** — the highest-signal free resource, written by people who review
  thousands of engineering resumes. Not fetchable from this environment.

What the open web *does* return for "AI engineer resume" is a wall of resume-builder SEO
(owlapply, mirrorcv, neuracv, careery, resumeoptimizerpro, techiecv, rejectless). These sites are
themselves AI-generated, they cite statistics with no source — "the top-scoring 10% carried a median
of 5 quantified outcomes", "listing ragas or LangSmith lands you in the top quartile 2.6× as often" —
and those numbers should be treated as invented until someone produces the study. **Do not tune a
resume against them.**

The credible layer is thinner and mostly says the same handful of things, below.

## What the credible sources agree on

Chiefly Gergely Orosz (*The Tech Resume Inside Out*, written from years of hiring at Uber/Skyscanner,
with input from 25+ recruiters and hiring managers), plus consistent recruiter-side guidance:

1. **The first pass is ~6–10 seconds.** Value has to be legible in a glance, which makes bullet
   *length* a structural concern, not a style preference.
2. **Results, not responsibilities.** "Worked on frontend features" → "reduced LCP by 35% via
   code-splitting and controlled hydration." Lead with the outcome; the technique follows it.
3. **Mirror the job description's vocabulary** without stuffing. Recruiters search internal databases
   by phrase, so the phrase has to literally appear.
4. **Experience carries the resume; skills support it.** Skills sections never substitute for
   evidence. Education goes last once you have professional history.
5. **Plain single-column, no graphics, standard font, PDF.** ATS myths are overblown — real people
   read these — but decoration costs scan speed with no upside.
6. **One page** at this experience level.

For AI roles specifically, the recurring theme across sources is **production evidence over model
trivia**: pipelines that ship, get evaluated, get deployed, and get monitored. Prompt engineering on
its own reads thin; tied to retrieval, evaluation, or a shipped product feature it reads senior.

## Better evidence: what the vault's own JDs actually say

Rather than trusting listicles about what employers want, this is measured over the **112 real job
descriptions** already captured in `career/jobs/*-candidates.json` — every AI/ML posting that passed
the filters since 2026-08-06. Percentage of JDs containing each term:

| Term | % of JDs | | Term | % of JDs |
|---|---|---|---|---|
| ship / shipped | 84% | | prompt | 30% |
| RAG | 80% | | reliability | 30% |
| agent | 70% | | retrieval | 28% |
| eval / evaluation | 68% | | monitoring | 28% |
| LLM | 62% | | observability | 26% |
| production | 62% | | experimentation | 23% |
| Python | 54% | | mentor | 22% |
| **stakeholder** | **46%** | | benchmark | 19% |
| AWS | 44% | | latency | 16% |
| end-to-end | 43% | | PyTorch | 16% |
| agentic | 37% | | MCP | 14% |
| **ambiguity** | **37%** | | guardrail | 12% |
| distributed | 30% | | LangChain | 7% |

Two things fall out of this that no resume guide would have told us:

- **Bedrock appears in 1 of 112 postings. FastAPI in 2. Terraform in 4.** The house vocabulary at
  NetRoadshow is nearly absent from the market's. Generic "AWS" (44%) and "LLM/agent/eval" carry the
  signal; the specific product names are detail, not headline.
- **"Stakeholder" (46%), "ambiguity" (37%) and "mentor" (22%) are collaboration signals**, and they
  are asked for about as often as the technical terms. See the gap below.

## The gap in the current resumes

Measured against the Cohere and Zillow specs built 2026-08-15:

**1. Zero collaboration signal.** Neither resume contains *stakeholder, cross-functional, partner,
mentor, ambiguity, team*. Every bullet is a solo build. Nearly half the market asks for the thing
that is entirely missing, and `career/index.md` has the evidence sitting unused: directing four
contract developers across iOS/Android/web at Aicon, being one of three co-founders there, the
VC-firm chatbot recorded as a **client engagement**, two primary contributors on `ai-services`, and
the beneficiary package another team adopted.

> **Correction, 2026-08-18.** An earlier version of this paragraph also claimed `career/index.md`
> held evidence of "partnering with non-technical Marketing/Sales/R&D stakeholders without PM
> support." **It does not.** Grep it: the only `R&D` hit is Aicon's "architecture, R&D, DevOps, AI
> ops", which describes Faizi's own work areas, and PM support appears nowhere. That invented phrase
> was carried out of this file and into a Databricks resume draft before an audit caught it.
> The items listed above are the real, checkable set. **Only `career/index.md` is a content source;
> this file is commentary and must never be mined for resume claims.**

**2. Bullets run long.** Median **37 words**, max 48, with 8–9 of 13 bullets over 35 words — and the
same pattern in the earlier Supabase resume, so this is a `/resume` habit rather than a one-off.
Convention for a 6-second scan is one to two lines, roughly 15–25 words. Every bullet currently opens
with a verb and buries the payload mid-sentence.

**3. Almost no numbers, and it is a data problem.** The whole NetRoadshow section — three years, the
bulk of both resumes — carries no metric at all, because every `Numbers:` field under it in
`career/index.md` is empty. Aicon's numbers (~10,000 users, ~200,000 captions, ~2s) and the paper's
(AUC 0.882) are the only quantities on the page, and they are from 2022–23. **This is the single
highest-leverage fix available and it needs Faizi**, not more drafting: documents indexed, queries
served, citation accuracy, DER achieved, tickets/week, agreement rate against human labels, hours
saved by the Slack bot.

**4. No GitHub in the header.** `career/index.md` holds this back deliberately until the public repos
are reviewed. Worth resolving — for AI roles a readable repo is direct evidence of the kind sources
agree beats credentials.

## Concrete changes to make

- Rewrite bullets outcome-first and cut to ~25 words: the payload belongs in the first six words, the
  stack and technique after it.
- Add one collaboration bullet per role, drawn from evidence already in `career/index.md`.
- Keep leading with **ship / production / eval / agent / RAG** — that vocabulary is already right and
  matches 60–84% of postings.
- Demote house-specific product names (Bedrock, FastAPI) out of headline position in bullets, keeping
  them in Skills where they cost nothing.
- Fill the empty `Numbers:` fields in `career/index.md` from Domo/CloudWatch, then rebuild.

## Status, 2026-08-17

All four resumes were rewritten for language and rebuilt. Done: bullets cut to one idea and roughly
25–30 words; collaboration evidence added (four contract developers at Aicon, "with one other
engineer" on shared NetRoadshow work); the 50× PyMuPDF number put to use.

The rewrite was driven by Faizi's own read of the drafts, and his objections are now the core of
`.claude/skills/job/references/resume-writing.md` as "The one-pass test" — a reject/rewrite table covering identity
claims that carry no fact, story framing with Faizi as protagonist, slang ("bake-off"), abstractions
too vague to picture, and sentences holding two ideas. Every line must land in one read.

Still open and still needing Faizi: the empty `Numbers:` fields under NetRoadshow, and the GitHub
header decision.

## Status, 2026-08-18 — shared-work attribution drifts

Auditing the Databricks draft turned up a defect that survives across builds: the beneficiary /
entity-resolution work (roughly 50,000 presentations) is **co-built with one other engineer** per
`career/index.md`, and that qualifier keeps getting dropped. Of seven resume specs on disk it is
present in three (smarsh, supabase, databricks) and absent in four — deepgram, elastic, zillow, and
providence, all already submitted. Nothing to retract, since none of them claim sole authorship in
words; they just omit the qualifier `career/index.md` asks for.

**Check on every build:** the three genuinely shared items — Bedrock Sentry, the beneficiary Bayesian
estimation, and the transcription service — each carry "with one other engineer". The HubSpot triage
service does not; Faizi wrote that one himself and it should stay unqualified.

## Status, 2026-08-20 — an invented tenure figure reached a submitted resume

The Intel AI Full Stack Engineer summary that went out on 2026-08-18 ended "First-author peer-reviewed
research and **three years** directing contract developers across iOS, Android, and web." Aicon ran
July 2022 – September 2023 — **14 months**. The figure appears nowhere in `career/index.md`; it was
generated in the summary and nothing checked it.

Swept every other spec on disk: the claim is unique to that one file, so this is a one-off, not a
drift. But it is the first case of a *fabricated number* rather than a dropped qualifier, and the
summary is where it happened — bullets get checked against `career/index.md` project by project while
the summary is written last and freely.

**Check on every build:** every number in the summary traces to a line in `career/index.md`, including
durations implied by date ranges. A tenure figure is a number.

Related, not fixed: the Supabase summary claims "job services **other teams** now build on" and the
only recorded adoption is one package taken up by one data team. Plural where the evidence is
singular. Worth a pass over the submitted summaries for the same shape.

## Status, 2026-08-21 — the reference build

Faizi's own read: the 2026-08-20 Intel referral resume is the best and most complete one yet.
Spec at `career/resumes/intel-ai-full-stack-engineer.json`, PDF and `.docx` beside it.

Its content is fully traceable — every claim in it already exists in `career/index.md`, so nothing
needs migrating and **the standing rule holds: never mine it, or any resume, for bullet text.**
What to carry forward is its *shape*, which is the first build to get all five of these at once:

1. **A Personal Projects section that leads with a shipped, linked product.** Verses is live on the
   App Store with a working link, followed by the audiobook generator and OpenFeed. Three years of
   resumes had no independent-shipping evidence at all; this is what closed the gap the AI-role
   sources call the strongest signal available at this tenure.
2. **GitHub in the header.** Resolved 2026-08-20 and now inherited by every build.
3. **A summary built on independent shipping**, not on identity claims — "Builds and ships AI
   products alone as well, including an iOS app live on the App Store, with the source and two other
   projects public on GitHub." It is the nearest honest proxy for developer-advocacy evidence, and it
   is checkable.
4. **Depth on two bullets rather than breadth on six.** Verses gets both the on-device
   `SpeechAnalyzer` transcription and the phonetic edit-distance matcher. Cutting the
   transcription-service and Slack-ingestion bullets to hold one page was the right trade.
5. **React first in Frameworks**, matching the actual strongest frontend stack, with Vue 3 recorded
   as the NetRoadshow stack.

Also the first build where a correction pass caught a live error before it shipped: the WhisperKit
claim, removed from Verses in commit `1d2d45f` on 2026-07-12. Verifying tool claims against the repo
rather than against memory is now part of the build, not a one-off.

**Start every future build from this structure**, then select content for the JD from
`career/index.md` as usual.


## Status, 2026-08-21 — under-filled pages shipped twice in one run

The GitLab and Databricks resumes both rendered at one page with roughly an inch of blank foot, and
both were treated as done. Faizi's call: **"We should always try to fill the page with relevant
info."**

The rule already existed in `resume-writing.md` (">~0.75in of blank foot means content was left out")
and was simply not acted on — the build stopped at the first render that fit on one page. Fixed by
adding a HubSpot triage bullet and the Publications paragraph to GitLab, and the triage bullet plus a
two-line Personal Projects section to Databricks; GitLab then spilled to two pages and gave the space
back by dropping the OpenFeed line.

**Check on every build:** fitting on one page is the constraint, not the target. Look at the render,
and if there is a visible gap above the bottom margin, add the next-most-relevant item from
`career/index.md` and rebuild. Budget two or three cycles per resume.
