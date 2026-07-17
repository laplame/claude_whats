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

export function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt * 1000),
  };
}
