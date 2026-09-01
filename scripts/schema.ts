import fs from "node:fs";
import path from "node:path";

import { ROOT } from "../lib/core/root.ts";
import { declarations, tables } from "../lib/core/ddl.ts";

const OUT = path.join(ROOT, "lib", "core", "tables.generated.ts");

const ddl = ["job", "profile"]
  .map((part) => fs.readFileSync(path.join(ROOT, "sql", `${part}.sql`), "utf8"))
  .join("\n");

const KINDS: Record<string, string> = {
  INTEGER: "z.number()",
  REAL: "z.number()",
  TEXT: "z.string()",
};

const shapeOf = (column: ReturnType<typeof declarations>[number]) => {
  const base = column.options
    ? `z.enum([${column.options.map((o) => JSON.stringify(o)).join(", ")}])`
    : KINDS[column.kind];
  return column.notnull || column.pk ? base : `${base}.nullable()`;
};

const declaredTables = tables(ddl);
const body = declaredTables
  .map((table) => {
    const fields = declarations(ddl, table)
      .map((column) => `    ${column.name}: ${shapeOf(column)},`)
      .join("\n");
    return `  ${table}: z.object({\n${fields}\n  }),`;
  })
  .join("\n");

fs.writeFileSync(
  OUT,
  `import { z } from "zod";\n\nexport const TABLES = {\n${body}\n};\n`,
  "utf8",
);

console.log(`wrote ${path.relative(ROOT, OUT)} — ${declaredTables.length} tables`);
for (const table of declaredTables) {
  const withEnum = declarations(ddl, table).filter((c) => c.options);
  if (withEnum.length)
    console.log(`  ${table}: ${withEnum.map((c) => `${c.name}(${c.options!.length})`).join(" ")}`);
}
