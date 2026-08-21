# Resume spec (JSON) — input to `scripts/build.js`

The spec is the resume's content. `build.js` owns every formatting decision, so the spec carries no
styling: no font sizes, no spacing, no bold-for-emphasis except the inline `**…**` noted below.

Write it to `career/resumes/<company>-<role-slug>.json`, then build. Keeping the spec next to the `.docx`
is what makes a later tweak a one-line edit and a rebuild rather than a fresh generation.

## Shape

```json
{
  "name": "Ada Lovelace",
  "contact": [
    "Denver, CO 80202",
    "ada@example.com",
    { "text": "linkedin.com/in/ada-lovelace", "link": "https://www.linkedin.com/in/ada-lovelace/" }
  ],
  "sections": [ ... ]
}
```

Optional top-level keys: `font` (default `Calibri`), `margins` (`{top,bottom,left,right}` in inches,
defaults 0.5 / 0.5 / 0.7 / 0.7).

Contact entries are joined with `|`. A plain string renders as text; `{text, link}` renders as a
hyperlink.

## Section types

Every section is `{ "heading": "...", "type": "...", ... }`. The heading renders uppercase, bold,
with a full-width rule under it. Order the sections as they should appear.

| `type` | Payload | Renders as |
|---|---|---|
| `paragraph` | `"text": "..."` | One flowing paragraph. Use for Summary and Publications. |
| `experience` | `"roles": [{title, company, dates, bullets[]}]` | `**Title, Company** — Dates` then a bulleted list. |
| `bullets` | `"items": ["...", "..."]` | A bare bulleted list, no role header. |
| `labeled` | `"items": [{label, text}]` | `**Label:** text`, one line each. Use for Skills. |
| `entries` | `"items": [{primary, secondary}]` | `**Primary** — Secondary`, one line each. Use for Education. |

## Inline formatting

Inside any `text` or bullet string: `**bold**`, `[label](url)`, and bare `https://…` URLs become a
hyperlink. Nothing else is parsed — no italics markers, no literal `•`, no `\n` (split into separate
items instead).

## Building

```bash
export NODE_PATH=$(npm root -g)
node "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/build.js" <spec.json> <out.docx> [--density tight|normal|roomy]
bash "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/topdf.sh" <out.docx>
```

`--density` is the one-page lever: `normal` is the default, `tight` shaves font size and spacing,
`roomy` opens it up when the content is short and the page looks sparse. Change density before you
start cutting content, and cut content before you change margins.
