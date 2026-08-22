# The profile

The user's own data — identity, the answers forms ask for, their experience, and what they are
looking for. It lives in the same database as everything else; there is one storage convention.

**They never write SQL for it, and they never edit a file.** They talk, paste a job history, or
upload a resume, and you write the rows. That is the whole interface: they get to speak naturally,
and the data stays consistent because you own the shape.

```bash
Q='python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/q.py"'
$Q --schema          # every table below, with what each is for
$Q --export > job.sql # the whole thing as portable SQL, if they ever want to leave
```

## Rules

**`NULL` means unanswered, and it is a hard stop.** When a form asks for a field whose value is
`NULL`, leave the form field empty, mark the application `blocked`, and name what is missing. Never
infer a phone number, a salary, a work-authorization answer, or a demographic answer.

```bash
$Q "SELECT * FROM unanswered"     -- everything that will block an application
```

**A row that does not exist means "none".** No `dealbreaker` rows is a real answer; it is not the
same as never having asked.

**Never invent experience.** A project belongs in `projects` only if the user said it happened.
Resume bullets may only come from `project_bullets` — that constraint is what keeps a generated
resume literally true.

**Preserve `search_notes` and `facts`.** They carry judgement and corrections that took real
conversation to establish. Add to them; do not rewrite them wholesale.

## Where things live

| Table | Holds |
| ----- | ----- |
| `profile` | Scalar answers, keyed `section.field` — `identity.email`, `availability.notice_period`. `NULL` = unanswered. |
| `education` | Degrees |
| `employers` → `projects` | The career history. **The only source a resume may draw from.** |
| `project_bullets` | The lines a resume selects from, one idea each |
| `project_technologies` | What a JD's named stack is matched against |
| `project_metrics` | Real, measured numbers. If it is not here, it does not go on a resume. |
| `project_links` | Paper, repo, App Store listing |
| `search_criteria` | Titles, dealbreakers, score up/down, location tiers, experience floors — `kind` says how the scorer uses the row |
| `search_notes` | Judgement that resists a schema. **Read on every scoring pass.** |
| `facts` | Corrections that must never be reproduced on a resume |
| `company_limits` | Stated per-company caps — recorded, not enforced |
| `accounts` | Which employer logins exist, and **where the password lives** |

### Selecting bullets for a posting

This is why the career history is relational rather than a document:

```sql
SELECT e.name AS employer, p.name AS project, b.text
FROM project_bullets b
JOIN projects p ON p.id = b.project_id
JOIN employers e ON e.id = p.employer_id
WHERE p.id IN (
  SELECT project_id FROM project_technologies
  WHERE technology IN ('Python','FastAPI','AWS Bedrock (Claude)')
)
ORDER BY e.seq, p.seq, b.seq;
```

`projects.shared_with` is how shared work stays honest — a project carrying
`'one other engineer'` must be described that way. `projects.status` distinguishes `shipped` from
`in_progress` and `discontinued`; a discontinued project is never described as live.

## ETL

When the user gives you career information in any form:

1. **Read what is there first.** `SELECT * FROM experience` and `SELECT * FROM profile`. You are
   merging, not replacing.
2. **Ask about anything genuinely ambiguous** — dates, whether work was solo, whether a number was
   measured or estimated. An invented number here becomes a lie on a resume.
3. **Write the rows.** One statement per fact, so a `CHECK` catches a bad status or a malformed row
   rather than silently accepting it.
4. **Tell them briefly what changed**, and what is still `NULL` that will block an application later.
