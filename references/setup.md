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

**2. Fill the profile by interviewing them.** They talk; you write the rows with `job-profile set
<section>.<name> <value>` — one answer per call, section derived from the key and refused if it is
not one of `job-profile sections`. Never hand them a file to edit, and never make the first pass a
form — the interview is a conversation. Afterwards they revise themselves in the dashboard, whose
Profile page writes every one of these tables, so tell them where it is once the profile stands up. `$Q --schema` documents every table. Cover:

- **Identity and contact** (`identity.*`), work authorization (`work_authorization.*`), availability
  (`availability.*`), compensation floor (`compensation.*`). Demographics (`demographics.*`) are
  optional, and `"Decline to self-identify"` is a complete answer — offer it rather than pressing.
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

**4. Check the tooling.** The `jobhunt` package and its dependencies are what fetching and scoring
run on; Typst and Poppler are only for the resume build.

```bash
python3 -c "import jobhunt.models" 2>/dev/null || echo 'pip install "$HOME/.claude/skills/job"'
command -v typst    || echo "brew install typst"
command -v pdftoppm || echo "brew install poppler"
```

**5. Do a dry run.** `/job scan --no-indeed`, then query `triage`. Sensible companies means the
filters are tuned; nothing, or thousands, means another pass — the drop counts say which rule, and
`job-scan ingest --redo` re-rules the same postings after each adjustment without fetching again.
