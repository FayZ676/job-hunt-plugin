#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  convertInchesToTwip,
} = require("docx");

const specPath = process.argv[2];
const outPath = process.argv[3];
if (!specPath || !outPath) {
  console.error("usage: build.js <spec.json> <out.docx> [--density tight|normal|roomy]");
  process.exit(1);
}

const flagIndex = process.argv.indexOf("--density");
const inlineArg = (process.argv.find((a) => a.startsWith("--density=")) || "").split("=")[1];
const density = inlineArg || (flagIndex !== -1 ? process.argv[flagIndex + 1] : "") || "normal";

const DENSITY = {
  tight: { body: 19, name: 34, section: 21, before: 100, after: 40, line: 240, bulletAfter: 20 },
  normal: { body: 20, name: 36, section: 22, before: 140, after: 60, line: 252, bulletAfter: 30 },
  roomy: { body: 21, name: 38, section: 23, before: 180, after: 80, line: 276, bulletAfter: 40 },
}[density] || null;

if (!DENSITY) {
  console.error(`unknown density "${density}" — use tight, normal, or roomy`);
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const FONT = spec.font || "Calibri";
const D = DENSITY;

const EM_DASH = "—";
const BULLET_NUMBERING = "resume-bullets";

function runsFromRich(value, base = {}) {
  if (typeof value === "string") return inlineRuns(value, base);
  if (Array.isArray(value)) return value.flatMap((v) => runsFromRich(v, base));
  if (value && typeof value === "object") {
    if (value.link) {
      return [
        new ExternalHyperlink({
          link: value.link,
          children: [new TextRun({ ...base, text: value.text || value.link, style: "Hyperlink" })],
        }),
      ];
    }
    return [new TextRun({ ...base, text: value.text || "", bold: !!value.bold, italics: !!value.italic })];
  }
  return [];
}

function inlineRuns(text, base = {}) {
  const out = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/\S+)/g;
  let last = 0;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    if (m[1] !== undefined) {
      out.push(new TextRun({ ...base, text: m[1], bold: true }));
    } else if (m[2] !== undefined) {
      out.push(
        new ExternalHyperlink({
          link: m[3],
          children: [new TextRun({ ...base, text: m[2], style: "Hyperlink" })],
        })
      );
    } else {
      out.push(
        new ExternalHyperlink({
          link: m[4],
          children: [new TextRun({ ...base, text: m[4], style: "Hyperlink" })],
        })
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(new TextRun({ ...base, text: text.slice(last) }));
  return out;
}

function sectionHeading(title) {
  return new Paragraph({
    spacing: { before: D.before, after: D.after, line: D.line },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
    children: [new TextRun({ text: title.toUpperCase(), bold: true, size: D.section, font: FONT })],
  });
}

function bodyParagraph(children, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 0, after: opts.after === undefined ? D.after : opts.after, line: D.line },
    children,
    ...opts.extra,
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: BULLET_NUMBERING, level: 0 },
    spacing: { after: D.bulletAfter, line: D.line },
    children: inlineRuns(text, { size: D.body, font: FONT }),
  });
}

const children = [];

children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40, line: D.line },
    children: [new TextRun({ text: spec.name, bold: true, size: D.name, font: FONT })],
  })
);

if (spec.contact && spec.contact.length) {
  const parts = [];
  spec.contact.forEach((item, i) => {
    if (i > 0) parts.push(new TextRun({ text: "  |  ", size: D.body, font: FONT }));
    parts.push(...runsFromRich(item, { size: D.body, font: FONT }));
  });
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20, line: D.line }, children: parts })
  );
}

for (const section of spec.sections) {
  children.push(sectionHeading(section.heading));

  if (section.type === "paragraph") {
    children.push(bodyParagraph(inlineRuns(section.text, { size: D.body, font: FONT })));
  } else if (section.type === "bullets") {
    section.items.forEach((item) => children.push(bullet(item)));
  } else if (section.type === "experience") {
    section.roles.forEach((role, i) => {
      children.push(
        new Paragraph({
          spacing: { before: i === 0 ? 0 : D.before, after: D.after, line: D.line },
          children: [
            new TextRun({ text: `${role.title}, ${role.company}`, bold: true, size: D.body, font: FONT }),
            new TextRun({ text: ` ${EM_DASH} ${role.dates}`, size: D.body, font: FONT }),
          ],
        })
      );
      (role.bullets || []).forEach((b) => children.push(bullet(b)));
    });
  } else if (section.type === "labeled") {
    section.items.forEach((item) =>
      children.push(
        bodyParagraph([
          new TextRun({ text: `${item.label}: `, bold: true, size: D.body, font: FONT }),
          ...inlineRuns(item.text, { size: D.body, font: FONT }),
        ])
      )
    );
  } else if (section.type === "entries") {
    section.items.forEach((item) =>
      children.push(
        bodyParagraph([
          new TextRun({ text: item.primary, bold: true, size: D.body, font: FONT }),
          ...inlineRuns(` ${EM_DASH} ${item.secondary}`, { size: D.body, font: FONT }),
        ])
      )
    );
  } else {
    console.error(`unknown section type "${section.type}"`);
    process.exit(1);
  }
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: D.body } } },
    characterStyles: [
      { id: "Hyperlink", name: "Hyperlink", basedOn: "DefaultParagraphFont", run: { color: "0563C1", underline: {} } },
    ],
  },
  numbering: {
    config: [
      {
        reference: BULLET_NUMBERING,
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.22), hanging: convertInchesToTwip(0.15) },
              },
            },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: {
            top: convertInchesToTwip(spec.margins?.top ?? 0.5),
            bottom: convertInchesToTwip(spec.margins?.bottom ?? 0.5),
            left: convertInchesToTwip(spec.margins?.left ?? 0.7),
            right: convertInchesToTwip(spec.margins?.right ?? 0.7),
          },
        },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (density: ${density})`);
});
