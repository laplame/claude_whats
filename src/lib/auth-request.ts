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
 * - COOKIE_SECURE=true  → fuerza Secure (HTTPS)
 * - COOKIE_SECURE=false → nunca Secure (HTTP / IP)
 * - sin definir         → Secure solo si NODE_ENV=production Y hay DOMAIN
 */
export function cookieSecureFlag(): boolean {
  const raw = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return (
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.DOMAIN?.trim())
  );
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
