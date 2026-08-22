# The profile

`career/profile.json` is the only file the user owns. Everything else is database.

**The user does not edit it by hand.** They tell you things — in conversation, by pasting a job
history, by uploading a resume or CV — and you write the structure. That is the whole point: they
get to talk, and the data stays consistent because you own the shape.

## Rules

**`null` means unanswered, and it is a hard stop.** When a form asks for a field that is `null`,
leave the form field empty, mark the application `blocked`, and name what is missing. Never infer a
phone number, a salary, a work-authorization answer, or a demographic answer. There is no `TODO`
convention any more — absence is typed.

**Empty list means "none", `null` means "not asked yet".** `"dealbreakers": []` is a real answer.
`"dealbreakers": null` is a gap worth filling.

**Never invent experience.** A project belongs in `employers[].projects[]` only if the user said it
happened. Resume bullets may only draw from what is here — that constraint is what keeps a
generated resume literally true.

**Preserve `notes` and `facts` when rewriting.** Those carry judgement and corrections that took
real conversation to establish; a careless overwrite loses more than it looks like.

## Shape

| Block | Holds | Fills |
| ----- | ----- | ----- |
| `identity` | Name, email, phone, location, links | Identity-tier form fields |
| `work_authorization` | Sponsorship, right to work, age | Policy-tier form fields |
| `availability` | Start date, notice, hours, relocation, remote preference | Policy-tier |
| `compensation` | `floor`, and a `notes` rule for how to answer | Policy-tier |
| `demographics` | EEO self-identification; declining is a complete answer | Policy-tier |
| `education` | Degrees | Resume, and form fields |
| `employers[]` | Employers, each with `projects[]` | **The only source resumes draw from** |
| `search` | What is worth applying to, and the rubric | Phase 2 scoring |
| `facts[]` | Corrections that must never be reproduced | Guards resume writing |
| `company_limits` | Per-company application caps — recorded, not enforced | Noted in the run report |
| `accounts[]` | Which employer logins exist, and **where the password lives** | Phase 4 logins |

### A project

```json
{
  "name": "RAG Q&A over financial filings",
  "start": "2023-12", "end": null,
  "summary": "Retrieval and answer layer over ~40,000 filings.",
  "bullets": ["One idea each, one sentence, a number only if it is real."],
  "technologies": ["Python", "FAISS", "Bedrock"],
  "metrics": ["median answer latency 1.2s"],
  "shared_with": "one other engineer",
  "status": "shipped"
}
```

`technologies` is what the resume builder matches a JD against, so name them explicitly rather than
leaving them implied in prose. `shared_with` is how "built with one other engineer" stays honest.
`status` is `shipped`, `in_progress`, or `discontinued` — a discontinued project does not get
described as live.

### The search block, and its notes

Enumerable things are typed: `titles.preferred`, `title_penalties`, `dealbreakers`,
`location.tiers`, `experience.floor_penalties`, `shortlist_threshold`.

`search.notes` is free text, and it is **read every time you score**. It holds the reasoning that a
schema flattens — why a trade-off goes the way it does, so you can apply it to a title nobody
enumerated. Keep it; do not try to compile it into weights.

## ETL

When the user gives you career information in any form:

1. Read what is already in `profile.json` first. You are merging, not replacing.
2. Ask about anything genuinely ambiguous — dates, whether work was solo, whether a number is
   measured or estimated. An invented number here becomes a lie on a resume.
3. Write the file back, whole and valid. Validate before saving:
   `python3 -c "import json;json.load(open('career/profile.json'))"`
4. Tell them briefly what changed — which blocks, and anything still `null` that will block an
   application later.
