import { NextRequest, NextResponse } from "next/server";
import { getConversationById, mergeConversations } from "@/lib/db";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const body = await req.json().catch(() => null);
  const keepId = Number(body?.keepId);
  const dropId = Number(body?.dropId);

  if (!Number.isInteger(keepId) || !Number.isInteger(dropId)) {
    return NextResponse.json({ error: "ids inválidos" }, { status: 400 });
  }
  if (keepId === dropId) {
    return NextResponse.json(
      { error: "no se puede fusionar una conversación consigo misma" },
      { status: 400 }
    );
  }
  if (!getConversationById(keepId, auth.id) || !getConversationById(dropId, auth.id)) {
    return NextResponse.json({ error: "conversación no encontrada" }, { status: 404 });
  }

  mergeConversations(keepId, dropId);
  return NextResponse.json({ ok: true, conversation: getConversationById(keepId) });
}
