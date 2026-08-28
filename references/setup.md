# First-run setup

Run when `$CAREER` is missing, or when the user asks for setup.

**1. Create the database.**

```bash
CAREER=$(job-paths career)
mkdir -p "$CAREER/resumes/submitted"
job-q -f "$HOME/.claude/skills/job/sql/seed.sql"
```

That creates `$CAREER/job.db` — the schema applies on connect — and seeds companies on Greenhouse,
Lever and Ashby plus a starting set of filters.

**2. Fill the profile by interviewing them.** Every field a form can ask for is already a column,
NULL until answered: the profile is seven single-row tables in `sql/profile.sql`, one per section,
and the columns are the schema — not something an interview or the dashboard adds to. They talk;
you answer with `job-profile set <section>.<name> <value>`, which names the table and the column —
one answer per call, and a name that is not declared is refused rather than filed as a new field.
If a form genuinely asks something no column covers, `ALTER TABLE` it into `sql/profile.sql` and add
it to `lib/schema.ts`; it then appears in the dashboard on the next connect.

**Answers are typed, and the type is the column.** The tables are `STRICT` and each column carries a
CHECK: a yes-or-no is INTEGER `0` or `1`, a date is `YYYY-MM-DD`, a time is `HH:MM`, a count is a
non-negative number, and a choice is one of the words its CHECK lists — so an interview answer of
"two weeks after an offer" is `availability.notice_period 2_weeks`, not a sentence in
`availability.earliest_start`. `job-profile set` refuses anything else and says what the column
takes; the dashboard reads the same declaration and renders a date picker, a yes/no or the list.
Give a column a new shape or a new choice there and both halves follow.

Never hand them a file to edit, and never make the first pass a form — the interview is a
conversation. Afterwards they revise themselves in the dashboard, whose Profile page writes every
one of these tables, so tell them where it is once the profile stands up. `$Q --schema` documents
every table. Cover:

- **Identity and contact** (`identity.*`), work authorization (`work_authorization.*`), availability
  (`availability.*`), compensation floor (`compensation.*`). Demographics (`demographics.*`) are
  optional, and `decline_to_say` is a complete answer — offer it rather than pressing.
- **What they're looking for** — titles that fit and don't, level, years of experience, hard
  dealbreakers, home metro. This becomes `search_criteria`; the reasoning a schema cannot hold goes
  in `search_notes`.
- **Their experience.** The longest part and the one that matters most: `employers` → `projects` is
  **the only source a resume may draw from**, so a thin profile produces thin resumes. Offer to read
  a resume, CV, or LinkedIn export and draft it for them to correct.

A `NULL` is not a failure — it is a hard stop later. Tell them which ones will block an application.

**3. Tune the watchlist.** The seeded companies and title filters are AI- and ML-flavored. If they
are hiring into a different field, rewrite both:

```sql
INSERT INTO filters(kind,pattern) VALUES('title_include','…');
INSERT INTO companies(slug,ats,name,source) VALUES('slug','greenhouse','Name','manual');
UPDATE companies SET active=0 WHERE slug='…';
```

**4. Check the tooling.** The npm dependencies and the linked `job-*` commands are what fetching
and scoring run on; Typst and Poppler are only for the resume build.

```bash
command -v job-scan || echo 'npm install --prefix "$HOME/.claude/skills/job" && npm link --prefix "$HOME/.claude/skills/job"'
command -v typst    || echo "brew install typst"
command -v pdftoppm || echo "brew install poppler"
```

**5. Do a dry run.** `/job scan --no-indeed`, then query `triage`. Sensible companies means the
filters are tuned; nothing, or thousands, means another pass — the drop counts say which rule, and
`job-scan ingest --redo` re-rules the same postings after each adjustment without fetching again.
