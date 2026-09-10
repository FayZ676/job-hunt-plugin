export const DENSITY = {
  tight: {
    body: 9.5,
    name: 17.0,
    name_gap: 5.0,
    section: 10.5,
    leading: 0.46,
    para_gap: 5.0,
    item_gap: 5.5,
    role_gap: 10.0,
    sec_above: 14.0,
    sec_below: 4.0,
    rule_gap: 2.0,
  },
  normal: {
    body: 10.0,
    name: 18.0,
    name_gap: 6.0,
    section: 11.0,
    leading: 0.5,
    para_gap: 6.0,
    item_gap: 6.5,
    role_gap: 12.0,
    sec_above: 17.0,
    sec_below: 4.5,
    rule_gap: 2.5,
  },
  roomy: {
    body: 10.5,
    name: 19.0,
    name_gap: 7.0,
    section: 11.5,
    leading: 0.56,
    para_gap: 7.0,
    item_gap: 8.0,
    role_gap: 14.5,
    sec_above: 21.0,
    sec_below: 5.5,
    rule_gap: 3.0,
  },
};

export type Density = keyof typeof DENSITY;

export const FONTS = { body: "Carlito" };

export const DEFAULT_MARGINS = { top: 0.5, bottom: 0.5, left: 0.7, right: 0.7 };

export const SECTION_TYPES: Record<string, [string, string]> = {
  paragraph: ['"text": "…"', "one flowing paragraph"],
  bullets: ['"items": ["…", "…"]', "a bare bulleted list, no sub-heading"],
  labeled: ['"items": [{"label": "…", "text": "…"}]', "**Label:** text, one per line"],
  entries: ['"items": [{"primary": "…", "secondary": "…"}]', "**Primary** — Secondary, one per line"],
  experience: [
    '"roles": [{"title", "company", "dates", "bullets": ["…"]}]',
    "**Title, Company** — Dates, then a bulleted list",
  ],
};

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/\S+)/g;

export const s = (text: unknown) =>
  `"${String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;

export function inline(text: string | null | undefined) {
  const held = text ?? "";
  const out: string[] = [];
  let last = 0;
  for (const match of held.matchAll(INLINE)) {
    const at = match.index!;
    if (at > last) out.push(`#text(${s(held.slice(last, at))})`);
    if (match[1] !== undefined) out.push(`#strong(text(${s(match[1])}))`);
    else if (match[2] !== undefined) out.push(`#link(${s(match[3])})[#text(${s(match[2])})]`);
    else out.push(`#link(${s(match[4])})[#text(${s(match[4])})]`);
    last = at + match[0].length;
  }
  if (held && last < held.length) out.push(`#text(${s(held.slice(last))})`);
  return out.join("") || '#text("")';
}

function rich(value: unknown): string {
  if (typeof value === "string") return inline(value);
  if (Array.isArray(value)) return value.map(rich).join("");
  if (value && typeof value === "object") {
    const held = value as Record<string, any>;
    if (held.link) return `#link(${s(held.link)})[#text(${s(held.text || held.link)})]`;
    if (held.bold) return `#strong(text(${s(held.text ?? "")}))`;
    if (held.italic) return `#emph(text(${s(held.text ?? "")}))`;
    return `#text(${s(held.text ?? "")})`;
  }
  return "";
}

export function build(spec: Record<string, any>, density: Density) {
  const d = DENSITY[density];
  const font = spec.font ?? FONTS.body;
  const m = { ...DEFAULT_MARGINS, ...(spec.margins ?? {}) };
  const L = [
    `#set page(paper: "us-letter", margin: (top: ${m.top}in, bottom: ${m.bottom}in, ` +
      `left: ${m.left}in, right: ${m.right}in))`,
    `#set text(font: ${s(font)}, size: ${d.body}pt)`,
    `#set par(leading: ${d.leading}em, spacing: ${d.para_gap}pt, justify: false)`,
    "#set smartquote(enabled: false)",
    '#show link: set text(fill: rgb("#0563c1"))',
    `#set list(indent: 1.1em, body-indent: 0.45em, spacing: ${d.item_gap}pt, ` + "marker: text(0.95em)[•])",
    "",
    "#let apart(gap, body) = block(above: gap, below: 0pt, width: 100%)[#body]",
    `#let sec(title) = block(above: ${d.sec_above}pt, below: ${d.sec_below}pt, width: 100%)[`,
    `  #text(size: ${d.section}pt, weight: "bold")[#title]`,
    `  #v(${d.rule_gap}pt)`,
    "  #line(length: 100%, stroke: 0.5pt)",
    "]",
    "",
    `#block(below: ${d.name_gap}pt, width: 100%)[#align(center)[#text(size: ${d.name}pt, weight: "bold")` +
      `[#text(${s(spec.name ?? "")})]]]`,
  ];

  const contact: unknown[] = spec.contact ?? [];
  if (contact.length) L.push(`#align(center)[${contact.map(rich).join('#text("  |  ")')}]`);

  for (const section of spec.sections ?? []) {
    L.push("");
    L.push(`#sec[#text(${s(String(section.heading ?? "").toUpperCase())})]`);
    switch (section.type) {
      case "paragraph":
        L.push(inline(section.text ?? ""));
        break;
      case "bullets":
        for (const item of section.items ?? []) L.push(`- ${inline(item)}`);
        break;
      case "labeled":
        (section.items ?? []).forEach((held: any, at: number) => {
          const line = `#strong(text(${s(`${held.label ?? ""}:`)}))#text(" ")${inline(held.text ?? "")}`;
          L.push(`#apart(${at ? d.item_gap : 0}pt)[${line}]`);
        });
        break;
      case "entries":
        (section.items ?? []).forEach((held: any, at: number) => {
          const line = `#strong(text(${s(held.primary ?? "")}))#text(" — ")${inline(held.secondary ?? "")}`;
          L.push(`#apart(${at ? d.item_gap : 0}pt)[${line}]`);
        });
        break;
      case "experience":
        (section.roles ?? []).forEach((held: any, at: number) => {
          const head = `#strong(text(${s(`${held.title ?? ""}, ${held.company ?? ""}`)}))`;
          const body = [`${head}#text(" — ")${inline(held.dates ?? "")}`].concat(
            (held.bullets ?? []).map((bullet: string) => `- ${inline(bullet)}`),
          );
          L.push(`#apart(${at ? d.role_gap : 0}pt)[`, ...body, "]");
        });
        break;
      default:
        throw new Error(
          `unknown section type "${section.type}" in '${section.heading}'; ` +
            `valid: ${Object.keys(SECTION_TYPES).join(", ")}`,
        );
    }
  }
  return `${L.join("\n")}\n`;
}
