import { NextRequest, NextResponse } from "next/server";
import {
  enqueueOutbox,
  getConversationById,
  getMessages,
  insertMessage,
  setMode,
} from "@/lib/db";
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

  const messages = getMessages(id, 100);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const conversation = getConversationById(id, auth.id);
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
  setMode(id, "HUMAN");
  enqueueOutbox(auth.id, id, conversation.phone, content);

  return NextResponse.json({ ok: true, messageId });
}
