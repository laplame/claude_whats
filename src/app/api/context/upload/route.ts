import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { includeContextFile } from "@/lib/context-exclusions";

const CONTEXT_DIR = path.resolve(process.cwd(), "data", "context");

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.filename !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const filename = safeFilename(body.filename);
  if (!filename.endsWith(".md")) {
    return NextResponse.json({ error: "only .md files allowed" }, { status: 400 });
  }

  if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR, { recursive: true });

  const dest = path.join(CONTEXT_DIR, filename);
  fs.writeFileSync(dest, body.content, "utf-8");
  // update mtime to now
  const now = Date.now();
  fs.utimesSync(dest, now / 1000, now / 1000);
  includeContextFile(filename);

  return NextResponse.json({ ok: true, filename });
}
