export const body = (ddl: string, table: string) =>
  ddl.match(
    new RegExp(
      `CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\)[^;]*;`,
    ),
  )?.[1] ?? "";

export const declared = (ddl: string, table: string, column: string) => {
  const chunk = body(ddl, table)
    .split(/\n  (?=\w+\s+(?:INTEGER|TEXT|REAL)\b|CHECK\b|PRIMARY KEY\b)/)
    .find((held) =>
      new RegExp(`^\\s*${column}\\s+(?:INTEGER|TEXT|REAL)\\b`).test(held),
    );
  const kind = chunk?.match(/\s*\w+\s+(INTEGER|TEXT|REAL)/)?.[1] ?? "TEXT";
  return { kind, check: chunk ?? "" };
};

export const choices = (ddl: string, table: string, column: string) => {
  const { check } = declared(ddl, table, column);
  const listed = check.match(new RegExp(`${column} IN \\(([\\s\\S]*?)\\)`));
  const options = listed
    ? [...listed[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    : [];
  return options.length ? options : null;
};

export const tables = (ddl: string) =>
  [...ddl.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(/g)].map((m) => m[1]);

export const declarations = (ddl: string, table: string) =>
  [...body(ddl, table).matchAll(/^ {2}(\w+)\s+(INTEGER|TEXT|REAL)\b(.*)$/gm)]
    .map(([, name, kind, rest]) => {
      const upto = rest.split(/\bCHECK\b/)[0];
      return {
        name,
        kind,
        notnull: /\bNOT NULL\b/.test(upto),
        pk: /\bPRIMARY KEY\b/.test(upto),
        options: choices(ddl, table, name),
      };
    });

const SINGLE_ROW =
  /CREATE TABLE IF NOT EXISTS (\w+) \(\s*\n\s*id\s+INTEGER PRIMARY KEY CHECK \(id = 1\)/g;

export const sections = (ddl: string) =>
  [...ddl.matchAll(SINGLE_ROW)].map((m) => m[1]);

export const columns = (ddl: string, table: string) =>
  [...body(ddl, table).matchAll(/^ {2}(\w+)\s+(?:INTEGER|TEXT|REAL)/gm)]
    .map((m) => m[1])
    .filter((name) => name !== "id");

export const vocabulary = (ddl: string, table: string, column: string) =>
  choices(ddl, table, column) ?? [];

const SHAPES: [RegExp, string][] = [
  [/IN \(0,1\)/, "0 or 1"],
  [/>= 0/, "a whole number, 0 or more"],
  [/date\(\w+ \|\| '-01'\)/, "a year, a year and month, or a full date"],
  [/IS date\(/, "a date, as YYYY-MM-DD"],
  [/datetime\(\w+\) IS NOT NULL/, "a timestamp"],
  [/GLOB '\[0-2\]\[0-9\]:/, "a 24-hour time, as HH:MM"],
  [/GLOB '\[A-Z\]\[A-Z\]\[A-Z\]'/, "a three-letter currency code, like USD"],
  [/LIKE '_%@_%\._%'/, "an email address"],
  [/LIKE 'http%:\/\/%\.%'/, "a URL, starting http"],
  [
    /NOT \w+ GLOB '\*\[A-Za-z\]\*'/,
    "a phone number — digits and separators, no words",
  ],
];

export function takes(ddl: string, table: string, column: string) {
  const listed = choices(ddl, table, column);
  if (listed) return `one of ${listed.join(", ")}`;
  const { kind, check } = declared(ddl, table, column);
  const shape = SHAPES.find(([pattern]) => pattern.test(check));
  if (shape) return shape[1];
  return kind === "INTEGER" ? "a whole number" : "anything but an empty answer";
}
