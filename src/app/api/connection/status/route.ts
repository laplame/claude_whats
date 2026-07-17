import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getConnectionState } from "@/lib/db";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const state = getConnectionState(auth.id);

  // Defensivo: por race conditions el bot a veces deja qr_string seteado
  // con status='connecting'. Si solo miráramos status==='qr', el
  // frontend nunca vería el QR en esos casos.
  const shouldShowQr =
    !!state.qr_string && (state.status === "qr" || state.status === "connecting");

  if (shouldShowQr && state.qr_string) {
    const qrPng = await QRCode.toDataURL(state.qr_string, { width: 320, margin: 2 });
    return NextResponse.json({
      status: "qr",
      qrPng,
      phone: null,
      updatedAt: state.updated_at,
    });
  }

  return NextResponse.json({
    status: state.status,
    qrPng: null,
    phone: state.phone,
    updatedAt: state.updated_at,
  });
}
