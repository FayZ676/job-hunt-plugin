# First-run setup

Run when `$CAREER` is missing, or when the user asks for setup. It exists so a new user is running
real scans the same day they install the plugin.

**1. Create the database.** From the project root:

```bash
cp -R "$HOME/.claude/skills/job/templates/career" ./career
python3 "$HOME/.claude/skills/job/scripts/q.py" \
  -f "$HOME/.claude/skills/job/sql/seed.sql"
```

That creates `$CAREER/job.db` — the schema applies on connect — and seeds it with companies on
Greenhouse, Lever and Ashby plus a starting set of filters. `$CAREER/resumes/` comes from the
template and holds output only.

**2. Fill the profile by interviewing them.** They talk; you write the rows. Never hand them a form
or a file to edit — chat is the whole interface. `references/profile.md` has the shape and the rules.
Cover:

- **Identity and contact**, work authorization, availability, compensation floor. Demographics are
  optional, and `"Decline to self-identify"` is a complete answer — offer it rather than pressing.
- **What they're looking for** — titles that fit and don't, level, years of experience, hard
  dealbreakers, home metro. This becomes `search_criteria`; whatever reasoning they give that a
  schema cannot hold goes in `search_notes`.
- **Their experience.** The longest part and the one that matters most: `employers` → `projects` is
  **the only source a resume may draw from**, so a thin profile produces thin resumes. Offer to read
  a resume, CV, or LinkedIn export and draft it for them to correct.

A `NULL` left in the profile is not a failure — it is a hard stop later, surfaced honestly. Tell them
which ones will block an application.

**3. Tune the watchlist.** The seeded companies and title filters are AI- and ML-flavored. If they
are hiring into a different field, rewrite both:

```sql
INSERT INTO filters(kind,pattern) VALUES('title_include','…');
INSERT INTO companies(slug,ats,name,source) VALUES('slug','greenhouse','Name','manual');
UPDATE companies SET active=0 WHERE slug='…';
```

**4. Check the tooling.**

```bash
python3 -c "import pydantic" 2>/dev/null || echo "python3 -m pip install pydantic"   # fetching
command -v typst    || echo "brew install typst"                                     # resume build
command -v pdftoppm || echo "brew install poppler"                                   # resume build
```

`pydantic` is what every source parses its payload into, so fetching needs it. Typst and Poppler are
only for the resume build; scoring and applying need neither.

**5. Do a dry run.** `/job scan --no-indeed`, then query `triage`. A first run that returns sensible
companies means the filters are tuned; nothing, or thousands, means another pass — the drop counts
say which one, and `ingest.py --redo` re-rules the same postings after each adjustment without
fetching again — `references/ingesting.md`.
