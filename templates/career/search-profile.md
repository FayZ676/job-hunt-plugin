Hand-edited. This is the highest-leverage file in the job loop — `/job` reads it to decide what's
worth your morning. Edit it whenever a scan surfaces something you'd never apply to, or misses
something you would.

Mechanical filters (which companies, title keywords, location, posting age) live in
`career/scan-config.json`. This file is the judgement layer.

> **TODO — fill these in before trusting the scores.** Every one of them changes the shortlist.
> - Compensation floor: `TODO`
> - Willing to relocate: `TODO`
> - Open to contract / part-time: `TODO`
> - Current urgency (actively leaving vs. opportunistic): `TODO`

---

## Target roles

**Level:** `TODO` — individual contributor or management? Entry, mid, or senior? State whether title
words like "Senior", "Staff", "Lead", or "Principal" are a preference in either direction, and
whether that preference outranks the years-of-experience floor below.

**Titles that fit**, in rough order of preference:
- `TODO`
- `TODO`

**Titles that don't:** `TODO` — name the near-misses that keep showing up so the scan stops
surfacing them.

### Years of experience — read the floor, not the title

**Baseline:** `TODO` — your years of professional experience, and the subset that is directly
relevant to the roles above. Say when the clock starts and why.

The numeric floor stated in the requirements is the binding technical gate, independent of any title
preference — it varies wildly between two reqs with identical titles, so always find it and state it
in the run entry.

| Stated floor | Effect |
|---|---|
| No numeric floor, or at/below your baseline | **No penalty.** These gate on demonstrated shipping |
| 1–2 years above your baseline | **−1.** Soft gates; worth applying to |
| 3+ years above your baseline | **−3.** Apply only when the content is a bullseye |

## What I actually bring

`TODO` — the three or four things you can evidence from `career/index.md`. This is what the scorer
matches JD language against, so write the capabilities, not the job titles.

## Location and onsite cadence

**Home metro:** `TODO`

| Tier | What it looks like | Effect |
|---|---|---|
| **A1** | Fully remote in your country, or remote with occasional offsites / ≤10% travel | **Preferred.** No penalty |
| **A2** | Local hybrid — office in your metro, any weekly cadence | No penalty; rank below an equivalent A1 role |
| **A3** | Local onsite — full-time in a metro office | Acceptable. **−1** against an equivalent remote role |
| **B** | Remote anchored to a hub outside your metro with monthly or quarterly onsite; a posting that never states cadence; ~25% travel | **−1 to −2**, still shortlistable |
| **C** | Any weekly-cadence hybrid or onsite requirement outside your metro; remote restricted to a country you can't work in; anything requiring relocation | **Zero it** |

### Reading location strings — the traps

A posting that lists many cities is usually onsite in one of them, not remote. "Remote" alongside a
named office often means hybrid. When cadence is unstated, score it tier B and say so in the run
entry.

## Score up

- `TODO` — company stages, domains, team shapes, or JD phrases that make a role more attractive.

## Score down

- `TODO` — the things that make an otherwise-fine role worse.

## Hard dealbreakers

Any one of these is a **hard zero**, regardless of the rest of the posting.

- `TODO` — e.g. requires relocation, requires clearance you don't hold, unpaid, commission-only,
  a technology or industry you won't work in.

## Scoring rubric

| Score | Meaning |
|---|---|
| 9–10 | Bullseye. Tailored resume today, apply today. |
| 7–8 | Strong. Worth a tailored resume. |
| 5–6 | Plausible but compromised on something real. Shortlist only if the day is thin. |
| 3–4 | Weak overlap. Log it, don't surface it. |
| 0–2 | Dealbreaker or wrong role. Log as skipped. |

**Shortlist threshold: 7 or above.** Every score must cite the specific JD language that drove it.

## Volume

`TODO` — how many applications a day is too many, if any. The skill enforces no cap by default.
