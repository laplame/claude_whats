import { NextRequest, NextResponse } from "next/server";
import {
  REPLY_DELAY_DEFAULT_SEC,
  REPLY_DELAY_MAX_SEC,
  REPLY_DELAY_MIN_SEC,
  getOwnerSettings,
  setOwnerReplyDelaySec,
} from "@/lib/db";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const settings = getOwnerSettings(auth.id);
  return NextResponse.json({
    reply_delay_sec: settings.reply_delay_sec,
    min: REPLY_DELAY_MIN_SEC,
    max: REPLY_DELAY_MAX_SEC,
    default: REPLY_DELAY_DEFAULT_SEC,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const body = await req.json().catch(() => null);
  const raw = body?.reply_delay_sec;
  const delay = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(delay)) {
    return NextResponse.json({ error: "reply_delay_sec inválido" }, { status: 400 });
  }

  const settings = setOwnerReplyDelaySec(auth.id, delay);
  return NextResponse.json({
    ok: true,
    reply_delay_sec: settings.reply_delay_sec,
    min: REPLY_DELAY_MIN_SEC,
    max: REPLY_DELAY_MAX_SEC,
    default: REPLY_DELAY_DEFAULT_SEC,
  });
}
