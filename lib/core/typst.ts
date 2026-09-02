export const DENSITY = {
  tight: {
    body: 9.5,
    name: 17.0,
    section: 10.5,
    leading: 0.58,
    para_gap: 4.0,
    sec_above: 7.0,
    sec_below: 3.0,
    rule_gap: 1.5,
    role_gap: 4.0,
    bullet_gap: 0.3,
  },
  normal: {
    body: 10.0,
    name: 18.0,
    section: 11.0,
    leading: 0.65,
    para_gap: 5.5,
    sec_above: 9.5,
    sec_below: 4.0,
    rule_gap: 2.0,
    role_gap: 5.5,
    bullet_gap: 0.4,
  },
  roomy: {
    body: 10.5,
    name: 19.0,
    section: 11.5,
    leading: 0.72,
    para_gap: 7.0,
    sec_above: 12.0,
    sec_below: 5.0,
    rule_gap: 2.5,
    role_gap: 7.0,
    bullet_gap: 0.5,
  },
};

export type Density = keyof typeof DENSITY;

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

export function rich(value: unknown): string {
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
  const font = spec.font ?? "Calibri";
  const m = { ...DEFAULT_MARGINS, ...(spec.margins ?? {}) };
  const L = [
    `#set page(paper: "us-letter", margin: (top: ${m.top}in, bottom: ${m.bottom}in, ` +
      `left: ${m.left}in, right: ${m.right}in))`,
    `#set text(font: (${s(font)}, "Carlito", "Helvetica Neue", "Arial"), size: ${d.body}pt)`,
    `#set par(leading: ${d.leading}em, spacing: ${d.para_gap}pt, justify: false)`,
    "#set smartquote(enabled: false)",
    '#show link: set text(fill: rgb("#0563c1"))',
    `#set list(indent: 1.1em, body-indent: 0.45em, spacing: ${d.bullet_gap}em, ` + "marker: text(0.95em)[•])",
    "",
    `#let sec(title) = block(above: ${d.sec_above}pt, below: ${d.sec_below}pt, width: 100%)[`,
    `  #text(size: ${d.section}pt, weight: "bold")[#title]`,
    `  #v(${d.rule_gap}pt)`,
    "  #line(length: 100%, stroke: 0.5pt)",
    "]",
    "",
    `#block(below: 2pt, width: 100%)[#align(center)[#text(size: ${d.name}pt, weight: "bold")` +
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
        L.push(
          (section.items ?? [])
            .map((item: any) => `#strong(text(${s(item.label ?? "")}))#text(": ")${inline(item.text ?? "")}`)
            .join(" \\\n"),
        );
        break;
      case "entries":
        L.push(
          (section.items ?? [])
            .map((item: any) => `#strong(text(${s(item.primary ?? "")}))#text(" — ")${inline(item.secondary ?? "")}`)
            .join(" \\\n"),
        );
        break;
      case "experience":
        (section.roles ?? []).forEach((role: any, at: number) => {
          if (at) L.push(`#v(${d.role_gap}pt)`);
          const head = `#strong(text(${s(`${role.title ?? ""}, ${role.company ?? ""}`)}))`;
          L.push(`${head}#text(" — ")${inline(role.dates ?? "")}`);
          for (const bullet of role.bullets ?? []) L.push(`- ${inline(bullet)}`);
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
