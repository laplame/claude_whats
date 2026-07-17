import { NextRequest, NextResponse } from "next/server";
import { getConversationById, setAppointment, setNotes, setTags, type AppointmentStatus } from "@/lib/db";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "AGENDADA",
  "CONFIRMADA",
  "COMPLETADA",
  "NO_SHOW",
  "CANCELADA",
];

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const conversation = getConversationById(id, auth.id);
  if (!conversation) {
    return NextResponse.json({ error: "conversación no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);

  if (typeof body?.notes === "string") {
    setNotes(id, body.notes);
  }

  if (Array.isArray(body?.tags) && body.tags.every((t: unknown) => typeof t === "string")) {
    setTags(id, body.tags);
  }

  if ("appointment_at" in (body ?? {}) || "appointment_status" in (body ?? {})) {
    const rawAt = body?.appointment_at;
    const appointmentAt =
      rawAt === null ? null : Number.isFinite(Number(rawAt)) ? Number(rawAt) : conversation.appointment_at;

    const rawStatus = body?.appointment_status;
    let status: AppointmentStatus | null = conversation.appointment_status;
    if (rawStatus === null) {
      status = null;
    } else if (typeof rawStatus === "string") {
      if (!APPOINTMENT_STATUSES.includes(rawStatus as AppointmentStatus)) {
        return NextResponse.json({ error: "estado de cita inválido" }, { status: 400 });
      }
      status = rawStatus as AppointmentStatus;
    }

    setAppointment(id, appointmentAt, appointmentAt ? status : null);
  }

  const updated = getConversationById(id);
  return NextResponse.json({ ok: true, conversation: updated });
}
