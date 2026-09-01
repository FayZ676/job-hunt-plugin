import Field from "@/components/edit/Field";
import type { Column } from "@/components/edit/columns";
import { Card, Section } from "@/components/ui";
import { instructions } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

const INSTRUCTIONS: Column = {
  name: "text", kind: "area",
  className: "pane-max",
  placeholder: "The work to go looking for, in the words a job board would use for it, "
    + "strongest first — then what makes an opening worth applying to, what puts you off, and "
    + "what makes it a no outright, including the seniority you are after and the years a posting "
    + "may ask for. Written the way you would brief someone reading the JD on your behalf.",
};

export default function InstructionsPage() {
  return (
    <Section title="Instructions for the search"
             sub="Your profile already says who you are. This is what to do with it, and every
                  search and every score reads it.">
      <Card>
        <Field table="instructions" rowid={1} column={INSTRUCTIONS}
               value={instructions().text} />
      </Card>
    </Section>
  );
}
