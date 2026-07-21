import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { excludeContextFile } from "@/lib/context-exclusions";
import { contextDirFor, ensureDefaultCloserContext } from "@/lib/bot-context";
import { detachContextFileFromAll } from "@/lib/db";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

const PROJECT_ROOT = path.resolve(process.cwd());

function isSafeSegment(segment: string) {
  if (!segment || segment.includes("..") || segment.includes("/") || segment.includes("\\")) return false;
  if (segment.length > 255) return false;
  return true;
}

function resolveFilename(rawName: string) {
  if (!rawName) return null;
  let decoded = rawName;

  try {
    decoded = decodeURIComponent(rawName);
  } catch {
    decoded = rawName;
  }

  const normalized = decoded.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((seg) => !isSafeSegment(seg))) return null;
  if (segments.length === 0) return null;

  return normalized;
}

function findFilePath(ownerId: number, filename: string): string | null {
  const contextDir = contextDirFor(ownerId);
  const candidates = [
    path.join(contextDir, filename),
    path.join(PROJECT_ROOT, filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

interface Ctx {
  params: Promise<{ filename: string }>;
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { filename: raw } = await params;
  const filename = resolveFilename(raw);
  if (!filename) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  const filePath = findFilePath(auth.id, filename);
  if (!filePath) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const contextDir = contextDirFor(auth.id);
  const isUploaded = filePath.startsWith(contextDir + path.sep);

  try {
    if (isUploaded) {
      fs.unlinkSync(filePath);
    }
    excludeContextFile(auth.id, filename);
    detachContextFileFromAll(auth.id, filename);
    // Nunca dejar la cuenta sin al menos un MD (contexto-general-closer).
    ensureDefaultCloserContext(auth.id);
    return NextResponse.json({
      ok: true,
      removed: isUploaded ? "file" : "hidden",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { filename: raw } = await params;
  const filename = resolveFilename(raw);
  if (!filename) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.content !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const full = findFilePath(auth.id, filename);
  if (!full) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    fs.writeFileSync(full, body.content, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { filename: raw } = await params;
  const filename = resolveFilename(raw);
  if (!filename) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  const full = findFilePath(auth.id, filename);
  if (!full) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const content = fs.readFileSync(full, "utf-8");
    return NextResponse.json({ filename, content });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
