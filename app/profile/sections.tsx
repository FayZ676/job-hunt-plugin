import Field from "@/components/edit/Field";
import { YES_NO, title, type Column } from "@/components/edit/columns";
import { Card, Disclosure, Sheet, Split, Stack, type Band, type Note } from "@/components/ui";
import { ask, grouped, identity, instructions, options } from "@/lib/web/queries";

const held = () => identity() as unknown as Record<string, unknown>;

const asked = (name: string): Column => {
  const { flag, ...hint } = ask("identity", name);
  const listed = options("identity", name);
  return { name, ...hint, options: flag ? YES_NO : listed.length ? listed : undefined };
};

const noted =
  (row: Record<string, unknown>) =>
  (column: Column): Note => {
    const answer = (row[column.name] ?? null) as string | number | null;
    return {
      label: title(column),
      mark: answer === null,
      value: (
        <Field
          table="identity"
          rowid={1}
          value={answer}
          column={{
            ...column,
            blocking: true,
            label: title(column),
            className: column.options ? "max-w-64" : "max-w-xl",
            placeholder: column.placeholder ?? "—",
          }}
        />
      ),
    };
  };

export function Identity() {
  const note = noted(held());
  const band = (group: { label?: string; names: string[] }): Band => ({
    label: group.label,
    notes: group.names.map(asked).map(note),
  });
  const [reach, ...rest] = grouped("identity");
  const folded = rest.filter((group) => group.fold);

  return (
    <Split
      rail={
        <>
          <Sheet bands={rest.filter((group) => !group.fold).map(band)} />

          {folded.length > 0 && (
            <Stack>
              {folded.map((group) => (
                <Disclosure key={group.label} summary={group.label}>
                  <Sheet flush bands={[{ notes: group.names.map(asked).map(note) }]} />
                </Disclosure>
              ))}
            </Stack>
          )}
        </>
      }
    >
      <Sheet label="10rem" bands={[band(reach)]} />
    </Split>
  );
}

const INSTRUCTIONS: Column = {
  name: "text",
  kind: "area",
  preview: true,
  className: "pane-max",
  placeholder:
    "Titles to look for, strongest first. Then the seniority you want, what makes an " +
    "opening worth applying to, and what rules one out.",
};

export function Instructions() {
  return (
    <Card>
      <Field table="instructions" rowid={1} column={INSTRUCTIONS} value={instructions().text} />
    </Card>
  );
}
