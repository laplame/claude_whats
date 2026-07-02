import { NextRequest, NextResponse } from "next/server";
import {
  enqueueOutbox,
  getConversationById,
  getMessages,
  insertMessage,
} from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const messages = getMessages(id, 50);
  return NextResponse.json({ messages });
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
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "contenido vacío" }, { status: 400 });
  }

  // El mensaje se guarda como 'human' y queda visible en el dashboard
  // de inmediato; el envío real por WhatsApp lo hace el proceso bot,
  // que poll-ea la tabla outbox cada 2s (procesos separados, sin
  // memoria compartida).
  const messageId = insertMessage(id, "human", content);
  enqueueOutbox(id, conversation.phone, content);

  return NextResponse.json({ ok: true, messageId });
}
