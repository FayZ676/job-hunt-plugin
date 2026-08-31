import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CAREER, one } from "@/lib/core/db";

const FROM = { resume: "postings", screenshot: "staged" } as const;

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
};

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; key: string[] }> }) {
  const { kind, key } = await params;
  const table = FROM[kind as keyof typeof FROM];
  if (!table) return new Response("no such kind", { status: 404 });

  const found = one(z.object({ p: z.string().nullable() }),
    `SELECT ${kind} AS p FROM ${table} WHERE key=?`, [decodeURIComponent(key.join("/"))]);
  if (!found?.p) return new Response("no such file", { status: 404 });

  const resolved = fs.realpathSync(found.p.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"));
  if (!resolved.startsWith(fs.realpathSync(CAREER) + path.sep) || !fs.statSync(resolved).isFile())
    return new Response("no such file", { status: 404 });

  return new Response(new Uint8Array(fs.readFileSync(resolved)), {
    headers: {
      "Content-Type": TYPES[path.extname(resolved).toLowerCase()] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${path.basename(resolved)}"`,
    },
  });
}
