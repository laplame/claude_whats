import { NextRequest, NextResponse } from "next/server";
import { getConversationById, setNotes, setTags } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "conversación no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);

  if (typeof body?.notes === "string") {
    setNotes(id, body.notes);
  }

  if (Array.isArray(body?.tags) && body.tags.every((t: unknown) => typeof t === "string")) {
    setTags(id, body.tags);
  }

  const updated = getConversationById(id);
  return NextResponse.json({ ok: true, conversation: updated });
}
