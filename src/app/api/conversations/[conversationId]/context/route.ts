import { NextRequest, NextResponse } from "next/server";
import { getContextFiles, attachContextFile, detachContextFile, getConversationById } from "@/lib/db";
import { isBotContextFile } from "@/lib/context-files";
import { resolveContextFilePath } from "@/lib/bot-context";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  if (!getConversationById(id, auth.id)) {
    return NextResponse.json({ error: "conversación no encontrada" }, { status: 404 });
  }

  const files = getContextFiles(id);
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  if (!getConversationById(id, auth.id)) {
    return NextResponse.json({ error: "conversación no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const filename = typeof body?.filename === "string" ? body.filename : null;
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });
  if (!isBotContextFile(filename)) {
    return NextResponse.json({ error: "file not allowed as bot context" }, { status: 400 });
  }
  if (!resolveContextFilePath(auth.id, filename)) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  try {
    attachContextFile(id, filename);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  if (!getConversationById(id, auth.id)) {
    return NextResponse.json({ error: "conversación no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const filename = typeof body?.filename === "string" ? body.filename : null;
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

  try {
    detachContextFile(id, filename);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
