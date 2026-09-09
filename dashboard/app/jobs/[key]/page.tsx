import Actions from "@/components/Actions";
import Opening from "./Opening";
import { assetAt, held } from "./held";
import { Card, Out, Prose, Stack, Stamp } from "@/components/ui";
import { offered } from "@/core/actions";
import type { Posting } from "@/lib/web/queries";

export const dynamic = "force-dynamic";

const TALL = "h-[min(44rem,calc(100dvh-25rem))]";
const TALL_WIDE = "xl:h-[min(44rem,calc(100dvh-25rem))]";
const FITTED = "#toolbar=0&navpanes=0&view=FitH";

const BAND = `flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1
  border-b border-base-300 px-3 py-2`;

const Description = ({ posting }: { posting: Posting }) => (
  <Card className={`overflow-auto ${TALL}`}>
    {posting.description ? (
      <Prose className="max-w-[72ch]">{posting.description}</Prose>
    ) : (
      <p className="text-sm text-soft">
        No description was captured for this posting. <Out href={posting.url}>Read it on {posting.source}</Out>.
      </p>
    )}
  </Card>
);

const Resume = ({ posting }: { posting: Posting }) => {
  const file = assetAt("resume", posting.key);
  const build = offered(posting.status)
    .map((action) => action.id)
    .filter((id) => id === "resume");

  return (
    <Stack className={`flex flex-col ${posting.resume ? TALL : TALL_WIDE}`}>
      <div className={BAND}>
        {posting.resume ? (
          <Stamp>{posting.resume.split("/").pop()}</Stamp>
        ) : (
          <span className="text-sm text-soft">No resume built for this opening yet.</span>
        )}

        <span className="flex items-center gap-3">
          {posting.resume && (
            <span className="text-sm">
              <Out href={file}>Open the PDF</Out>
            </span>
          )}
          <Actions ids={build} argument={posting.key} />
        </span>
      </div>

      {posting.resume && (
        <iframe
          src={`${file}${FITTED}`}
          title={`Resume tailored for ${posting.company}`}
          className="min-h-0 w-full flex-1 bg-white"
        />
      )}
    </Stack>
  );
};

export default async function JobPage({ params }: PageProps<"/jobs/[key]">) {
  const found = await held(params);
  const { posting } = found;

  return (
    <>
      <Opening found={found} />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Description posting={posting} />
        <Resume posting={posting} />
      </div>
    </>
  );
}
