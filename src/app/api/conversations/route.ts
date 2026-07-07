import { NextResponse } from "next/server";
import { listConversations } from "@/lib/db";
import { restoreSqliteFromMongo } from "@/lib/mongo";

let restoreAttempted = false;

export async function GET() {
  if (!restoreAttempted && process.env.MONGODB_URI) {
    restoreAttempted = true;
    restoreSqliteFromMongo().catch(() => {});
  }

  const conversations = listConversations();
  return NextResponse.json({ conversations });
}
