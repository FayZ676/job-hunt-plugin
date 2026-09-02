import type { Database } from "better-sqlite3";

const quoted = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

type Held = { type: string; name: string; sql: string | null };

export function* dump(database: Database) {
  yield "BEGIN TRANSACTION;";
  const objects = database
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
    .all() as Held[];

  for (const held of objects.filter((one) => one.type === "table")) {
    if (held.sql) yield `${held.sql};`;
    const columns = (database.pragma(`table_info("${held.name}")`) as { name: string }[]).map(
      (column) => `"${column.name}"`,
    );
    if (!columns.length) continue;
    for (const row of database.prepare(`SELECT * FROM "${held.name}"`).all() as Record<string, unknown>[])
      yield `INSERT INTO "${held.name}"(${columns.join(",")}) VALUES(${Object.values(row).map(quoted).join(",")});`;
  }

  for (const held of objects.filter((one) => one.type !== "table")) if (held.sql) yield `${held.sql};`;

  yield "COMMIT;";
}
