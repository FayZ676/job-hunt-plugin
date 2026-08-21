# Content template

Section order for the spec's `sections` array. Omit any section the JD makes irrelevant, except
Experience and Education. The JSON shape of each section is in `spec-schema.md`.

## Summary — `paragraph`

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

## Experience — `experience`

Roles in reverse-chronological order:

| title | company | dates |
|---|---|---|
| Machine Learning Engineer | Northwind Analytics | November 2023 – Present |
| Co-Founder & Lead Developer | Kestrel Labs | July 2022 – September 2023 |
| Research Assistant | State University | May 2022 – January 2023 |

Bullets: one idea each, one sentence, under ~30 words, a number only if a real one exists in
`career/index.md`. 3–8 per role, ordered by relevance to the JD. A role with no relevant projects gets a single summary
bullet, not a full list.

## Projects — `bullets`

Only when an independent project maps to the JD better than a work
project it would displace. Mark status honestly: discontinued / in progress.

## Publications — `paragraph`

Only when the JD is research-adjacent:

> First author, biomedical information extraction for COVID-19 fake news detection. Big Data and
> Cognitive Computing 2023, 7(1), 46 — Editor's Choice. https://www.mdpi.com/2504-2289/7/1/46

## Education — `entries`

| primary | secondary |
|---|---|
| BS Computer Science | State University, May 2022 |
| Associate of Science | Community College, May 2020 |

## Skills — `labeled`

Labels: Languages, Frameworks, AI/ML, Cloud & Data, Delivery. Drop a label entirely rather than pad
it. Drawn from the selected bullets plus the JD's named technologies the candidate actually has — no
aspirational entries, no soft skills.

## Notes

- The publication title in `career/index.md` is recorded only by URL; fetch or confirm the exact
  title and author list before printing a citation.
- Keep the contact line identical to the `## Profile` section of `career/index.md` — it is the
  canonical header. Same for Education.
