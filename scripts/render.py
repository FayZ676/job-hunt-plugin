
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

DENSITY = {
    "tight":  {"body": 9.5, "name": 17.0, "section": 10.5, "leading": 0.58,
               "para_gap": 4.0, "sec_above": 7.0, "sec_below": 3.0,
               "rule_gap": 1.5, "role_gap": 4.0, "bullet_gap": 0.30},
    "normal": {"body": 10.0, "name": 18.0, "section": 11.0, "leading": 0.65,
               "para_gap": 5.5, "sec_above": 9.5, "sec_below": 4.0,
               "rule_gap": 2.0, "role_gap": 5.5, "bullet_gap": 0.40},
    "roomy":  {"body": 10.5, "name": 19.0, "section": 11.5, "leading": 0.72,
               "para_gap": 7.0, "sec_above": 12.0, "sec_below": 5.0,
               "rule_gap": 2.5, "role_gap": 7.0, "bullet_gap": 0.50},
}
DEFAULT_MARGINS = {"top": 0.5, "bottom": 0.5, "left": 0.7, "right": 0.7}

SECTION_TYPES = {
    "paragraph":  ('"text": "…"',
                   "one flowing paragraph"),
    "bullets":    ('"items": ["…", "…"]',
                   "a bare bulleted list, no sub-heading"),
    "labeled":    ('"items": [{"label": "…", "text": "…"}]',
                   "**Label:** text, one per line"),
    "entries":    ('"items": [{"primary": "…", "secondary": "…"}]',
                   "**Primary** — Secondary, one per line"),
    "experience": ('"roles": [{"title", "company", "dates", "bullets": ["…"]}]',
                   "**Title, Company** — Dates, then a bulleted list"),
}
INLINE = re.compile(r"\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|(https?://\S+)")


def s(text):
    return '"' + str(text or "").replace("\\", "\\\\").replace('"', '\\"') + '"'


def inline(text):
    out, last = [], 0
    for m in INLINE.finditer(text or ""):
        if m.start() > last:
            out.append(f"#text({s(text[last:m.start()])})")
        if m.group(1) is not None:
            out.append(f"#strong(text({s(m.group(1))}))")
        elif m.group(2) is not None:
            out.append(f"#link({s(m.group(3))})[#text({s(m.group(2))})]")
        else:
            out.append(f"#link({s(m.group(4))})[#text({s(m.group(4))})]")
        last = m.end()
    if text and last < len(text):
        out.append(f"#text({s(text[last:])})")
    return "".join(out) or "#text(\"\")"


def rich(value):
    if isinstance(value, str):
        return inline(value)
    if isinstance(value, list):
        return "".join(rich(v) for v in value)
    if isinstance(value, dict):
        if value.get("link"):
            return f"#link({s(value['link'])})[#text({s(value.get('text') or value['link'])})]"
        body = f"#text({s(value.get('text',''))})"
        if value.get("bold"):
            body = f"#strong(text({s(value.get('text',''))}))"
        if value.get("italic"):
            body = f"#emph(text({s(value.get('text',''))}))"
        return body
    return ""


def build(spec, density):
    d = DENSITY[density]
    font = spec.get("font", "Calibri")
    m = {**DEFAULT_MARGINS, **(spec.get("margins") or {})}
    L = [
        f'#set page(paper: "us-letter", margin: (top: {m["top"]}in, bottom: {m["bottom"]}in, '
        f'left: {m["left"]}in, right: {m["right"]}in))',
        f'#set text(font: ({s(font)}, "Carlito", "Helvetica Neue", "Arial"), size: {d["body"]}pt)',
        f'#set par(leading: {d["leading"]}em, spacing: {d["para_gap"]}pt, justify: false)',
        '#set smartquote(enabled: false)',
        '#show link: set text(fill: rgb("#0563c1"))',
        f'#set list(indent: 1.1em, body-indent: 0.45em, spacing: {d["bullet_gap"]}em, '
        f'marker: text(0.95em)[•])',
        "",
        f'#let sec(title) = block(above: {d["sec_above"]}pt, below: {d["sec_below"]}pt, width: 100%)[',
        f'  #text(size: {d["section"]}pt, weight: "bold")[#title]',
        f'  #v({d["rule_gap"]}pt)',
        '  #line(length: 100%, stroke: 0.5pt)',
        ']',
        "",
        f'#block(below: 2pt, width: 100%)[#align(center)[#text(size: {d["name"]}pt, weight: "bold")'
        f'[#text({s(spec.get("name",""))})]]]',
    ]
    contact = spec.get("contact") or []
    if contact:
        joined = '#text("  |  ")'.join(rich(c) for c in contact)
        L.append(f'#align(center)[{joined}]')

    for sec_ in spec.get("sections") or []:
        L.append("")
        L.append(f'#sec[#text({s(str(sec_.get("heading","")).upper())})]')
        kind = sec_.get("type")
        if kind == "paragraph":
            L.append(inline(sec_.get("text", "")))
        elif kind == "bullets":
            for item in sec_.get("items") or []:
                L.append(f'- {inline(item)}')
        elif kind == "labeled":
            rows = [f'#strong(text({s(i.get("label",""))}))#text(": "){inline(i.get("text",""))}'
                    for i in sec_.get("items") or []]
            L.append(" \\\n".join(rows))
        elif kind == "entries":
            rows = [f'#strong(text({s(i.get("primary",""))}))#text(" — "){inline(i.get("secondary",""))}'
                    for i in sec_.get("items") or []]
            L.append(" \\\n".join(rows))
        elif kind == "experience":
            for i, role in enumerate(sec_.get("roles") or []):
                if i:
                    L.append(f'#v({d["role_gap"]}pt)')
                head = f'#strong(text({s(role.get("title","") + ", " + role.get("company",""))}))'
                L.append(f'{head}#text(" — "){inline(role.get("dates",""))}')
                for b in role.get("bullets") or []:
                    L.append(f'- {inline(b)}')
        else:
            raise SystemExit(f'unknown section type "{kind}" in {sec_.get("heading")!r}; '
                             f'valid: {", ".join(SECTION_TYPES)}')
    return "\n".join(L) + "\n"


SPEC_HELP = """A resume spec is content only -- render.py owns every formatting decision.

{{
  "name": "Ada Lovelace",
  "contact": ["Denver, CO 80202", "ada@example.com",
              {{"text": "linkedin.com/in/ada", "link": "https://linkedin.com/in/ada"}}],
  "sections": [{{"heading": "Summary", "type": "paragraph", "text": "…"}}]
}}

Optional top-level keys: "font" (default Calibri), "margins" ({margins}, inches).
Contact entries are joined with " | "; a plain string renders as text, {{text, link}}
as a hyperlink. Every section is {{heading, type, …}}; the heading renders uppercase,
bold, with a full-width rule.

Inside any text or bullet string: **bold**, [label](url) and bare https://… become
links. Nothing else is parsed -- no italics, no literal bullet chars, no \\n (split
those into separate items).

Section types:
{types}"""


def print_spec():
    width = max(len(k) for k in SECTION_TYPES)
    types = "\n".join(f"  {k:<{width}}  {payload}\n  {'':<{width}}  renders as {shape}"
                       for k, (payload, shape) in SECTION_TYPES.items())
    print(SPEC_HELP.format(margins=json.dumps(DEFAULT_MARGINS), types=types))


def main():
    ap = argparse.ArgumentParser(description="Render a resume spec to PDF with Typst.")
    ap.add_argument("spec", nargs="?")
    ap.add_argument("out", nargs="?", help="default: <spec>.pdf")
    ap.add_argument("--density", default="normal", choices=sorted(DENSITY))
    ap.add_argument("--keep-typ", action="store_true", help="write the .typ alongside the PDF")
    ap.add_argument("--spec", dest="spec_only", action="store_true",
                    help="print the spec contract and every section type, then exit")
    args = ap.parse_args()

    if args.spec_only:
        print_spec()
        return 0
    if not args.spec:
        ap.error("a spec path is required (or pass --spec to print the contract)")

    if not shutil.which("typst"):
        sys.exit("typst not found: brew install typst")

    spec = json.load(open(args.spec, encoding="utf-8"))
    out = args.out or os.path.splitext(args.spec)[0] + ".pdf"
    markup = build(spec, args.density)

    typ_path = os.path.splitext(out)[0] + ".typ" if args.keep_typ else None
    if typ_path:
        open(typ_path, "w", encoding="utf-8").write(markup)
        source = typ_path
        cleanup = None
    else:
        fd, source = tempfile.mkstemp(suffix=".typ", dir=os.path.dirname(out) or ".")
        os.write(fd, markup.encode("utf-8")); os.close(fd)
        cleanup = source

    try:
        r = subprocess.run(["typst", "compile", source, out], capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"typst failed:\n{r.stderr}")
    finally:
        if cleanup:
            os.unlink(cleanup)
    print(f"wrote {out} (density: {args.density})")


if __name__ == "__main__":
    main()
