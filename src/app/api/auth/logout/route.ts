import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";
import { getSessionToken } from "@/lib/auth-request";

export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  if (token) deleteSession(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return res;
}
