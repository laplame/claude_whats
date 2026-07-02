import { NextRequest, NextResponse } from "next/server";
import { getConversationById, setMode } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (body?.mode !== "AI" && body?.mode !== "HUMAN") {
    return NextResponse.json({ error: "modo inválido" }, { status: 400 });
  }

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "conversación no encontrada" }, { status: 404 });
  }

  setMode(id, body.mode);
  return NextResponse.json({ ok: true });
}
