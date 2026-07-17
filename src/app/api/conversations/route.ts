import { NextRequest, NextResponse } from "next/server";
import { listConversations } from "@/lib/db";
import { restoreSqliteFromMongo } from "@/lib/mongo";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

let restoreAttempted = false;

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  if (!restoreAttempted && process.env.MONGODB_URI) {
    restoreAttempted = true;
    restoreSqliteFromMongo().catch(() => {});
  }

  const conversations = listConversations(auth.id);
  return NextResponse.json({ conversations });
}
