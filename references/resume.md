# Resume writing

Turning the profile tables into a targeted PDF for one job description, in any field. The rules are
the ones university career offices, ATS vendors and hiring research agree on; the **Authorities**
behind them are listed at the end.

**The deliverable is the `.pdf`.** Never hand back a markdown resume; the `.json` spec written along
the way is a build input, kept next to the PDF so a later tweak is an edit and a rebuild.

## Where the content comes from

**The profile tables are the only source.** `identity` supplies the header block and `education` the
degrees. Every bullet, and every number in one, is written from `projects.about` — the whole record,
framing and facts together.

- **Never mine an existing resume for bullet text.** Copies in circulation carry exactly the errors
  the profile has since corrected. `projects.about` and `employers.about` hold those corrections;
  read them before writing and never contradict one.
- **A number goes on the resume only if `about` states it** — no estimating, no rounding up, no
  "over N" where N was never measured. A duration implied by a date range is a number too.
- **Shared work is described as shared.** A bullet that says so — "with one other analyst" — costs
  nothing and is true. Work done alone stays unqualified.
- **Discontinued and in-progress work is labeled**, and **singular evidence stays singular** — one
  site adopting one procedure is not "sites". Verify every tool, system or credential claim against
  the record rather than memory.

## Process

1. Get the JD — a `prospects.description`, pasted text, a file path, or a URL — and extract its hard
   requirements, day-to-day responsibilities, and implied signals.
2. Read the profile tables and score each project on overlap. Write the mapping down before
   drafting; it decides ordering and cuts.

   ```sql
   SELECT employer, project, about FROM career;
   ```

3. Select: roles reverse-chronological, most relevant project first within each role. Cut irrelevant
   projects entirely. A role with nothing relevant gets one summary bullet.
4. Draft against **Writing**, then test every line against **The one-pass test**.
5. Write the spec to `$CAREER/resumes/<company>-<role-slug>.json`, build, and look at the page.
6. Report gaps: JD requirements with no evidence in the tables; bullets a missing number would
   strengthen, named specifically; close-call cuts.

## Writing

**`references/writing.md` governs the voice** — the banned generated vocabulary, sentence shape, and
word choice. Read it before drafting. What follows is what a resume adds to it.

Plain professional English, read once at speed, each line leaving a fact behind. The first pass is
about seven seconds and decides whether there is a second one; eye tracking puts that gaze on titles,
employers and dates, then education, so **whatever the candidate is hired for goes above the fold**.

**Every bullet is an accomplishment, not a duty.** The formula every source converges on is *action
verb + what you did + the result it produced*, and Google's version says the same with the
measurement made explicit: **accomplished X, as measured by Y, by doing Z.** "Responsible for
scheduling" is a duty; "cut overtime 18% by rebuilding the four-week rotation" is an accomplishment.

- **Start with a strong action verb; no personal pronouns.** No "I", "we", "my". Past tense for
  finished work, present tense for the role currently held.
- **One idea per bullet, one sentence, ~15–25 words and never over 30.** `about` packs several ideas
  into a paragraph because it is a reference. Split them. Long bullets are this skill's standing
  habit — a measured median of 37 words.
- **Outcome first**, in the first six words; method, tools and scale after it. Every noun phrase
  must be concrete enough to picture.
- **Quantify what the profile measured** — percentages, dollars, volume, headcount, time saved — with
  the baseline that makes the figure mean something ("from 50 to 100"). Where no metric exists, scope
  the work instead: caseload, budget, shift size. A bullet with no number is fine; flag it in the gap
  report.
- **Mirror the JD's vocabulary where it is honest.** Their word over the profile's synonym, spelled
  out rather than abbreviated, since both a scanner and a parser match the literal term. Never blur
  one credential, system or method into a neighboring one. Mirror term by term, though — a document
  carrying every posting phrase in the posting's own order reads as generated, and recruiters say so.
- **Match the verb to the work's real status.** "Delivered" and "replaced" assert an outcome already
  happened; "built" covers work that exists and is not yet live. Check `about` first, and never print
  a projected number.
- **One judgment call and one collaboration bullet per role**, where the tables support them: the
  decision and what it bought; the cross-functional work, mentoring, supervising or client contact
  that postings ask for as often as technical skill, and that a set of solo bullets always misses.

### The one-pass test

Rewrite any line matching a row below.

| Reject | Because | Instead |
| ------ | ------- | ------- |
| "Responsible for managing the front desk and daily correspondence" | A duty, not an accomplishment | "Ran a 60-visitor-a-day front desk, cutting average check-in from 6 minutes to 2" |
| "Detail-oriented professional passionate about operational excellence" | Identity claim with no fact in it | "Six years in hospital operations: scheduling a 60-bed unit and the supply contracts behind it" |
| "Noticed the vendor had been double-billing us for months and escalated it" | Story with the candidate as protagonist; the reader wants the outcome | "Recovered $40K in duplicate vendor charges by auditing three years of invoices" |
| "Improved processes across the department" | Abstract enough to mean anything | "Cut invoice approval from 9 days to 2 by routing approvals through the ERP" |
| "Trained new hires, holding formal certification for the roles that required it, and rewrote the safety checklist in two parts: …" | Two unrelated ideas in one sentence; forces a second pass | Two bullets, one idea each |
| "Spearheaded a comprehensive initiative to optimize stakeholder collaboration" | Generated vocabulary end to end, and nothing changed hands | "Ran the weekly review that moved three vendor disputes off the ops backlog" |
| "Rebuilt the intake form, resulting in improved processing efficiency" | Participial tail with an abstract consequence; no quantity, no baseline | "Cut intake processing from 9 days to 2 by rebuilding the form" |

## Check on every build

Each is a defect that reached a built resume, two of them a submitted one.

1. **Every number in the summary traces to a row**, durations included. The summary is written last
   and freely, and is where the one fabricated figure — "three years" for a 14-month tenure — was
   generated.
2. **Every shared project carries its qualifier.** This is the defect that drifts most: present in
   three specs of seven, absent in four already submitted.
3. **No plural where the evidence is singular.**
4. **No personal pronouns, no bullet that states a duty rather than an accomplishment, no
   unexplained date gap, and no line carrying the vocabulary or the shapes `references/writing.md`
   bans.**
5. **The rendered image was looked at**, not just the page count, and the page is full — more than
   ~0.75in of blank foot means content was left out.

## Format and length

The template's layout is plain because the file is parsed before it is read. What is chosen per build
is the wording: headings a parser recognizes — Experience, Education, Skills, Certifications — never
a clever synonym, and one `Title, Employer, dates` shape on every entry, with no date gap unexplained.

**Length follows seniority, not habit.** One full page for early career and anyone under roughly ten
years; two *full* pages for mid-level, senior, managerial or academic work, where hiring managers
prefer the longer document by a wide margin. Never a page and a third. Resume-builder sites cite
invented statistics ("75% are auto-rejected"); never tune against them — the parser is a reason to
keep wording literal, not a reason to stuff keywords.

## What this employer asks for

Postings are better evidence than any listicle, and the corpus is local. Measure it rather than
guess:

```sql
SELECT COUNT(*) FILTER (WHERE description LIKE '%stakeholder%') * 100 / COUNT(*) AS pct
  FROM prospects;
```

**Frequent verbs and outcomes are headline vocabulary; named products and house systems are detail.**
A term in most postings belongs in the summary and the bullets wherever it is honest; a term in two of
a hundred belongs in Skills, where it costs nothing. Collaboration language runs as high as the
technical terms and is the easiest thing to miss.

## Build

```bash
pdftoppm -jpeg -r 95 "$CAREER/resumes/<slug>.pdf" /tmp/page   # then read /tmp/page-1.jpg
```

`lib/core/typst.ts` owns every formatting decision; a layout change belongs there, so every future
resume inherits it.

Where the image shows a gap above the bottom margin, add the next-most-relevant content — another
real bullet, a Projects line, the Publications paragraph — rebuild, and look again. Expect two or
three cycles. To overflow, in this order: `--density tight`; cut the least relevant bullets; tighten
wording so bullets stop before wrapping one word onto a new line; margins in the spec, never below
0.4in.

Build with `--key` or the PDF is written and nothing is recorded. Then give the gap report, and
offer, without doing: a matching cover letter, and writing anything newly surfaced back into the
profile tables.

## The spec

**`job-resume spec` prints the contract** — top-level keys, contact entries, inline markup, and every
section type. Read it there; this file covers only what belongs in each. Emit sections in this order, omitting any the JD makes irrelevant except Experience and Education,
but order headings by what this JD hires on: a license-gated role puts Certifications above
Experience, a new graduate puts Education first.

| Section | Type | What goes in it |
|---|---|---|
| Summary | `paragraph` | Two or three lines of fact, never self-description. **Opens with the total years** — see below. Skip it when it would only restate the bullets; a weak summary costs two bullets' worth of space |
| Experience | `experience` | Reverse-chronological. 3–8 bullets per role, ordered by relevance to the JD |
| Projects | `bullets` | Only when independent or volunteer work maps to the JD better than the paid work it would displace. Mark status honestly: discontinued / in progress |
| Certifications | `entries` | Licenses, certifications and clearances the JD names or the field requires: `{"primary": "RN, Colorado", "secondary": "issued March 2021"}`. Never one the record shows as expired |
| Publications | `paragraph` | Only when the JD is research-adjacent. Confirm the exact title and author list against the paper before printing a citation |
| Education | `entries` | From the `education` table, verbatim: `{"primary": "BS Computer Science", "secondary": "State University, May 2022"}` |
| Skills | `labeled` | Group under labels the field uses, drawn from the selected bullets plus the JD's named tools that appear in `project_technologies`. Drop a label rather than pad it. No aspirational entries, no soft skills. Order each label by depth of professional use, and never place a skill under an employer whose projects do not carry it |

**Keep the contact line identical to the `identity` table** — it is the canonical header.

**The summary opens with the total years** — a reader filtering on experience may discard the
candidate before the end of the sentence. Then the two or three specifics this JD cares about, then
what came before, stated as work performed.

> Eight years in hospital operations, most of it on the systems behind patient flow: scheduling for a
> 60-bed unit, supply contracts renegotiated across three sites, and the intake process two other
> units adopted. Earlier, staffed a 24-hour emergency desk.

## Authorities

Harvard MCCS *Create a Strong Resume*; Yale OCS *Writing Impactful Resume Bullets*; MIT CAPD *Make
Your Resume ATS-Friendly*; UC Berkeley Career Engagement *Resumes*; Laszlo Bock's X-Y-Z formula; the
Ladders 2018 eye-tracking study; the ResumeGo 2018 length study.
