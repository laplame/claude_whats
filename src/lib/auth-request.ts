import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  getUserBySessionToken,
  type DashboardUser,
} from "./auth";

export function getSessionToken(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export function getRequestUser(req: NextRequest): DashboardUser | null {
  return getUserBySessionToken(getSessionToken(req));
}

export function requireUser(req: NextRequest): DashboardUser | NextResponse {
  const user = getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  return user;
}

export function isUnauthorized(result: DashboardUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Cookie de sesión.
 * En VPS por HTTP (http://IP:3000) NO puede ir Secure: el browser la descarta
 * y el login "funciona" pero /api/auth/me sigue en 401.
 *
 * Solo pone Secure si COOKIE_SECURE=true|1|yes.
 * Default: false (apto para IP:HTTP). Con HTTPS real: COOKIE_SECURE=true.
 */
export function cookieSecureFlag(): boolean {
  const raw = process.env.COOKIE_SECURE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecureFlag(),
    path: "/",
    expires: new Date(expiresAt * 1000),
  };
}
