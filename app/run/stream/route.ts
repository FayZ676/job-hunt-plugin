import { begin, halt, watch } from "@/lib/web/runs";

export const dynamic = "force-dynamic";

const failed = (error: unknown) => new Response((error as Error).message, { status: 400 });

export async function POST(request: Request) {
  const asked = (await request.json()) as
    { stop: string } | { action: string; argument?: string; note?: string; run?: string | null };

  try {
    if ("stop" in asked) {
      halt(asked.stop);
      return Response.json({ run: asked.stop });
    }
    return Response.json({ run: begin(asked) });
  } catch (error) {
    return failed(error);
  }
}

export async function GET(request: Request) {
  const run = new URL(request.url).searchParams.get("run");
  if (!run) return new Response("no conversation named", { status: 400 });

  try {
    return new Response(watch(run, request.signal), {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failed(error);
  }
}
