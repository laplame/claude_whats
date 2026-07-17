import { NextRequest, NextResponse } from "next/server";
import { deleteConversation, getConversationById } from "@/lib/db";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

interface Ctx {
  params: Promise<{ conversationId: string }>;
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

  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
