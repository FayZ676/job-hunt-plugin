const WIDTH = 48;

const wrap = (text: string, width: number) => {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else { lines.push(line); line = word; }
      while (line.length > width) { lines.push(line.slice(0, width)); line = line.slice(width); }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
};

const shown = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

export function table(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0]);
  const cells = rows.map((row) => headers.map((header) => wrap(shown(row[header]), WIDTH)));
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...cells.map((row) => Math.max(...row[column].map((l) => l.length)))));

  const line = (parts: string[]) =>
    parts.map((part, column) => part.padEnd(widths[column])).join("  ").trimEnd();

  const out = [line(headers), line(widths.map((width) => "-".repeat(width)))];
  for (const row of cells) {
    const height = Math.max(...row.map((held) => held.length));
    for (let n = 0; n < height; n++) out.push(line(row.map((held) => held[n] ?? "")));
  }
  return out.join("\n");
}

export function printRows(rows: Record<string, unknown>[], asJson = false) {
  if (asJson) console.log(JSON.stringify(rows, null, 2));
  else if (!rows.length) console.log("(no rows)");
  else console.log(table(rows));
}
