import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createDashboardUser,
  createSession,
  ensureSeedAdminUser,
} from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/auth-request";

export async function POST(req: NextRequest) {
  ensureSeedAdminUser();

  if (process.env.AUTH_ALLOW_SIGNUP === "false") {
    return NextResponse.json({ error: "el registro está deshabilitado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp : "";
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  const name = typeof body?.name === "string" ? body.name : null;
  const role = typeof body?.role === "string" ? body.role : null;

  if (!email.trim() || !whatsapp.trim() || !passcode) {
    return NextResponse.json(
      { error: "email, whatsapp y passcode son requeridos" },
      { status: 400 }
    );
  }

  try {
    const user = createDashboardUser({ email, whatsapp, passcode, name, role });
    const session = createSession(user.id);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "no se pudo registrar" },
      { status: 400 }
    );
  }
}
