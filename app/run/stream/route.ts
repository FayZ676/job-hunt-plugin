import { spawn } from "node:child_process";

import { ROOT } from "@/lib/core/root";
import { asked, phases } from "@/lib/web/phases";

export const dynamic = "force-dynamic";

const outermost = (held: NodeJS.ProcessEnv) =>
  Object.fromEntries(
    Object.entries(held).filter(([name]) => !name.startsWith("CLAUDE_CODE") && name !== "CLAUDECODE"),
  ) as NodeJS.ProcessEnv;

export async function POST(request: Request) {
  const { phase, argument = "" } = (await request.json()) as { phase: string; argument?: string };

  if (!phases().some((held) => held.id === phase)) return new Response(`no such phase: ${phase}`, { status: 400 });
  if (/[\n\r]/.test(argument)) return new Response("an argument is one line", { status: 400 });

  const child = spawn(
    "claude",
    [
      "-p",
      asked(phase, argument.trim()),
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
    ],
    { cwd: ROOT, env: outermost(process.env), stdio: ["ignore", "pipe", "pipe"] },
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let open = true;
      let held = "";

      const send = (line: unknown) => {
        if (open) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      };
      const close = () => {
        if (open) controller.close();
        open = false;
      };

      child.stdout.on("data", (chunk: Buffer) => {
        held += chunk.toString();
        const lines = held.split("\n");
        held = lines.pop() ?? "";
        for (const line of lines) if (line.trim() && open) controller.enqueue(encoder.encode(`${line}\n`));
      });

      child.stderr.on("data", (chunk: Buffer) => send({ type: "stderr", text: chunk.toString() }));

      child.on("error", (error) => {
        send({ type: "stderr", text: error.message });
        close();
      });

      child.on("close", (code) => {
        send({ type: "exit", code });
        close();
      });

      request.signal.addEventListener("abort", () => child.kill("SIGTERM"));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
