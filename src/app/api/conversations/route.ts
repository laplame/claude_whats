import { NextResponse } from "next/server";
import { listConversations } from "@/lib/db";

export async function GET() {
  const conversations = listConversations();
  console.log(`[api/conversations] retornando ${conversations.length} conversaciones`);
  return NextResponse.json({ conversations });
}
