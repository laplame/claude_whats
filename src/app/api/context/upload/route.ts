import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { includeContextFile } from "@/lib/context-exclusions";
import { contextDirFor } from "@/lib/bot-context";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.filename !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const filename = safeFilename(body.filename);
  if (!filename.endsWith(".md")) {
    return NextResponse.json({ error: "only .md files allowed" }, { status: 400 });
  }

  const contextDir = contextDirFor(auth.id);
  if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir, { recursive: true });

  const dest = path.join(contextDir, filename);
  fs.writeFileSync(dest, body.content, "utf-8");
  // update mtime to now
  const now = Date.now();
  fs.utimesSync(dest, now / 1000, now / 1000);
  includeContextFile(auth.id, filename);

  return NextResponse.json({ ok: true, filename });
}
