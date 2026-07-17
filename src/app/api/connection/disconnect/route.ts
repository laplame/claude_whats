import { NextRequest, NextResponse } from "next/server";
import { enqueueConnectionCommand, setConnectionState } from "@/lib/db";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  setConnectionState(auth.id, { status: "disconnected", qr_string: null, phone: null });

  // El bot poll-ea esta cola por-tenant, cierra la sesión de auth.id, borra
  // su carpeta auth/{id}/ y genera un QR nuevo sin tocar a otras cuentas ni
  // reiniciar el proceso.
  enqueueConnectionCommand(auth.id, "disconnect");

  return NextResponse.json({ ok: true });
}
