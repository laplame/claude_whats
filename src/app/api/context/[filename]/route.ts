import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { excludeContextFile } from "@/lib/context-exclusions";
import { detachContextFileFromAll } from "@/lib/db";

const CONTEXT_DIR = path.resolve(process.cwd(), "data", "context");
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

function findFilePath(filename: string): string | null {
  const candidates = [
    path.join(CONTEXT_DIR, filename),
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

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { filename: raw } = await params;
  const filename = resolveFilename(raw);
  if (!filename) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  const filePath = findFilePath(filename);
  if (!filePath) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isUploaded = filePath.startsWith(CONTEXT_DIR + path.sep);

  try {
    if (isUploaded) {
      fs.unlinkSync(filePath);
    }
    excludeContextFile(filename);
    detachContextFileFromAll(filename);
    return NextResponse.json({
      ok: true,
      removed: isUploaded ? "file" : "hidden",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { filename: raw } = await params;
  const filename = resolveFilename(raw);
  if (!filename) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.content !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const full = findFilePath(filename);
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

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { filename: raw } = await params;
  const filename = resolveFilename(raw);
  if (!filename) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }

  const full = findFilePath(filename);
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
