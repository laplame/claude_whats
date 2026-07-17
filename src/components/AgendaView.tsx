"use client";

import { useMemo, useState } from "react";
import type { AppointmentStatus, ConversationListItem } from "./ConversationList";
import { ChatAvatar } from "@/lib/avatar";

type CrmPatch = Partial<
  Pick<ConversationListItem, "notes" | "tags" | "appointment_at" | "appointment_status">
>;

const STATUS_META: Record<AppointmentStatus, { label: string; badgeClass: string }> = {
  AGENDADA: { label: "Agendada", badgeClass: "bg-sky-50 text-sky-700" },
  CONFIRMADA: { label: "Confirmada", badgeClass: "bg-emerald-50 text-emerald-700" },
  COMPLETADA: { label: "Completada", badgeClass: "bg-slate-100 text-slate-700" },
  NO_SHOW: { label: "No asistió", badgeClass: "bg-rose-50 text-rose-700" },
  CANCELADA: { label: "Cancelada", badgeClass: "bg-amber-50 text-amber-700" },
};

const STATUS_OPTIONS: AppointmentStatus[] = [
  "AGENDADA",
  "CONFIRMADA",
  "COMPLETADA",
  "NO_SHOW",
  "CANCELADA",
];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" });
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AgendaViewProps {
  conversations: ConversationListItem[];
  onSelect: (id: number) => void;
  onCrmUpdated: (id: number, patch: CrmPatch) => void;
}

export default function AgendaView({ conversations, onSelect, onCrmUpdated }: AgendaViewProps) {
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [savingId, setSavingId] = useState<number | null>(null);

  const scheduled = useMemo(
    () =>
      conversations.filter(
        (c): c is ConversationListItem & { appointment_at: number } => c.appointment_at != null
      ),
    [conversations]
  );

  const dayItems = useMemo(
    () =>
      scheduled
        .filter((c) => isSameDay(new Date(c.appointment_at * 1000), cursor))
        .sort((a, b) => a.appointment_at - b.appointment_at),
    [scheduled, cursor]
  );

  const upcomingCount = scheduled.length;

  async function updateStatus(
    conversation: ConversationListItem & { appointment_at: number },
    status: AppointmentStatus
  ) {
    if (savingId === conversation.id) return;
    setSavingId(conversation.id);
    const previous = conversation.appointment_status;
    onCrmUpdated(conversation.id, { appointment_status: status });
    try {
      const res = await fetch(`/api/crm/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_at: conversation.appointment_at,
          appointment_status: status,
        }),
      });
      if (!res.ok) onCrmUpdated(conversation.id, { appointment_status: previous });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800 sm:text-xl">Agenda</h1>
            <p className="mt-1 text-xs text-slate-500">
              {upcomingCount} turno{upcomingCount === 1 ? "" : "s"} agendado
              {upcomingCount === 1 ? "" : "s"} en total
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCursor((d) => addDays(d, -1))}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              aria-label="Día anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setCursor(startOfDay(new Date()))}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setCursor((d) => addDays(d, 1))}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              aria-label="Día siguiente"
            >
              →
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm font-semibold capitalize text-slate-700">
          {formatDayLabel(cursor)}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {dayItems.length === 0 ? (
          <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            No hay turnos agendados este día. Agendá uno desde el chat de cada
            contacto (sección CRM → &quot;Cita / turno&quot;).
          </div>
        ) : (
          <ol className="mx-auto max-w-2xl space-y-2">
            {dayItems.map((c) => {
              const status = c.appointment_status ?? "AGENDADA";
              const meta = STATUS_META[status];
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-sm font-bold text-slate-800">{formatTime(c.appointment_at)}</p>
                  </div>
                  <ChatAvatar id={c.id} name={c.name} phone={c.phone} size={36} />
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {c.name || c.phone}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{c.phone}</p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                    <select
                      value={status}
                      disabled={savingId === c.id}
                      onChange={(e) => updateStatus(c, e.target.value as AppointmentStatus)}
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 outline-none focus:border-sky-400"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
