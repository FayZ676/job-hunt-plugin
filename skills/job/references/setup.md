# First-run setup

Run when `career/` is missing, or when the user asks for setup. It exists so a new
user is running real scans the same day they install the plugin.

**1. Copy the templates.** From the project root:

```bash
cp -R "${CLAUDE_PLUGIN_ROOT}/templates/career" ./career
```

That gives them `watchlist.toml` (a starter watchlist of companies on Greenhouse, Lever, and
Ashby), `indeed.toml`, `search-profile.md`, `index.md`, `manual-boards.md`, an empty
`applications.jsonl`, and the `jobs/`, `resumes/`, and `staged/` directories.

**2. Interview the user, then fill the templates for them.** Do not hand back a wall of `TODO`s and
ask them to edit files — ask the questions in chat, and write the answers in. Ask about:

- **Identity and contact** — everything under `### Identity` in `career/index.md`.
- **Work authorization, availability, compensation floor** — the rest of the answer bank.
  Demographic self-identification is optional; `Decline to self-identify` is a complete answer, and
  offering that is better than pressing.
- **What they're looking for** — titles that fit, titles that don't, level, years of experience,
  hard dealbreakers. This becomes `career/search-profile.md`.
- **Where they'll work** — remote only, or a home metro. Their answer replaces the `YOUR_CITY`
  placeholders in `watchlist.toml` and the locations in `indeed.toml`.
- **Their experience** — employers, dates, titles, and the projects underneath each. This is the
  longest part and it is the one that matters most: **`career/index.md` is the only thing a resume
  may be built from**, so a thin file produces thin resumes. Offer to read a résumé, CV, or LinkedIn
  export if they have one, and draft `career/index.md` from it for them to correct.

**3. Tune the watchlist.** The shipped `companies` list in `watchlist.toml` is AI- and ML-flavored, and so are the
`title_include` regexes. If the user is hiring into a different field, rewrite both — the watchlist
is a starting point, not a recommendation.

**4. Check the tooling.** Only the resume build needs anything installed:

```bash
command -v typst || echo "brew install typst"
command -v pdftoppm || echo "brew install poppler"
```

Scanning and scoring work without either; the user can start there and install before the first
resume.

**5. Do a dry run.** `/job scan --no-indeed` and show them the review note. A first scan that returns
sensible companies is the signal that `watchlist.toml` is tuned; one that returns nothing or
thousands means the filters need another pass, and the per-filter drop counts say which one.

**Setup is done when `career/index.md` has no `TODO` left in the answer bank.** A `TODO` there blocks
applications later, so it is cheaper to resolve it now.
