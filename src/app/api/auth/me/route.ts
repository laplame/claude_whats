import { NextRequest, NextResponse } from "next/server";
import { ensureSeedAdminUser } from "@/lib/auth";
import { getRequestUser } from "@/lib/auth-request";

export async function GET(req: NextRequest) {
  ensureSeedAdminUser();
  const user = getRequestUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user });
}
