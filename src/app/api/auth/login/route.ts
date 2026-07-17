import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSession,
  findDashboardUserForLogin,
  verifyPasscode,
  ensureSeedAdminUser,
} from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/auth-request";

export async function POST(req: NextRequest) {
  ensureSeedAdminUser();

  const body = await req.json().catch(() => null);
  const identifier =
    typeof body?.identifier === "string"
      ? body.identifier
      : typeof body?.email === "string"
        ? body.email
        : typeof body?.whatsapp === "string"
          ? body.whatsapp
          : "";
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";

  if (!identifier.trim() || !passcode) {
    return NextResponse.json(
      { error: "email/whatsapp y passcode son requeridos" },
      { status: 400 }
    );
  }

  const userRow = findDashboardUserForLogin(identifier);
  if (!userRow || !verifyPasscode(passcode, userRow.passcode_hash)) {
    return NextResponse.json({ error: "credenciales inválidas" }, { status: 401 });
  }

  const session = createSession(userRow.id);
  const res = NextResponse.json({
    ok: true,
    user: {
      id: userRow.id,
      email: userRow.email,
      whatsapp: userRow.whatsapp,
      name: userRow.name,
      role: userRow.role,
    },
  });
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return res;
}
