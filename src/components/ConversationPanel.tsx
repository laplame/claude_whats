"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";
import MergePicker from "./MergePicker";
import { ChatAvatar } from "@/lib/avatar";

export type AppointmentStatus = "AGENDADA" | "CONFIRMADA" | "COMPLETADA" | "NO_SHOW" | "CANCELADA";

export interface ConversationSummary {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  notes: string;
  tags: string[];
  human_mode_expires_at: number | null;
  appointment_at: number | null;
  appointment_status: AppointmentStatus | null;
}

type CrmPatch = Partial<
  Pick<ConversationSummary, "notes" | "tags" | "appointment_at" | "appointment_status">
>;

const APPOINTMENT_STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "AGENDADA", label: "Agendada" },
  { value: "CONFIRMADA", label: "Confirmada" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "NO_SHOW", label: "No asistió" },
  { value: "CANCELADA", label: "Cancelada" },
];

/** Convierte epoch seconds <-> valor de un <input type="datetime-local"> en hora local. */
function toDatetimeLocalValue(unixSeconds: number | null): string {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function fromDatetimeLocalValue(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

interface MessageItem {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface ConversationPanelProps {
  conversation: ConversationSummary;
  onBack?: () => void;
  onDelete: (id: number) => void | Promise<void>;
  onModeChanged: (id: number, mode: "AI" | "HUMAN") => void;
  onCrmUpdated: (id: number, patch: CrmPatch) => void;
  onMerged: (droppedId: number) => void;
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConversationPanel({
  conversation,
  onBack,
  onDelete,
  onModeChanged,
  onCrmUpdated,
  onMerged,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notesDraft, setNotesDraft] = useState(conversation.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [crmVisible, setCrmVisible] = useState(false);
  const [mergePickerOpen, setMergePickerOpen] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [selectingContext, setSelectingContext] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [addingToContext, setAddingToContext] = useState(false);
  const [contextFeedback, setContextFeedback] = useState<string | null>(null);
  const [appointmentDraft, setAppointmentDraft] = useState(
    toDatetimeLocalValue(conversation.appointment_at)
  );
  const [appointmentStatusDraft, setAppointmentStatusDraft] = useState<AppointmentStatus>(
    conversation.appointment_status ?? "AGENDADA"
  );
  const [savingAppointment, setSavingAppointment] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotesDraft(conversation.notes);
    setSelectingContext(false);
    setSelectedMessageIds([]);
    setContextFeedback(null);
    setAppointmentDraft(toDatetimeLocalValue(conversation.appointment_at));
    setAppointmentStatusDraft(conversation.appointment_status ?? "AGENDADA");
  }, [conversation.id, conversation.notes, conversation.appointment_at, conversation.appointment_status]);

  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      const res = await fetch(`/api/messages/${conversation.id}`);
      if (!res.ok) {
        console.error("Error cargando mensajes:", res.status, res.statusText);
        return;
      }
      if (cancelled) return;
      const data = await res.json().catch((err) => {
        console.error("Error parseando mensajes:", err);
        return null;
      });
      if (!cancelled && data?.messages) setMessages(data.messages);
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [conversation.id]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || !isNearBottom) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isNearBottom]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    const updateNearBottom = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setIsNearBottom(distanceFromBottom < 80);
    };

    container.addEventListener("scroll", updateNearBottom);
    updateNearBottom();
    return () => container.removeEventListener("scroll", updateNearBottom);
  }, []);

  function scrollToBottom() {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    setIsNearBottom(true);
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/crm/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (res.ok) {
        onCrmUpdated(conversation.id, { notes: notesDraft });
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function persistTags(tags: string[]) {
    onCrmUpdated(conversation.id, { tags });
    await fetch(`/api/crm/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
  }

  function handleAddTag() {
    const tag = tagInput.trim();
    setTagInput("");
    if (!tag || conversation.tags.includes(tag)) return;
    persistTags([...conversation.tags, tag]);
  }

  async function persistAppointment(appointmentAt: number | null, status: AppointmentStatus | null) {
    setSavingAppointment(true);
    try {
      const res = await fetch(`/api/crm/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_at: appointmentAt, appointment_status: status }),
      });
      if (res.ok) {
        onCrmUpdated(conversation.id, {
          appointment_at: appointmentAt,
          appointment_status: appointmentAt ? status : null,
        });
      }
    } finally {
      setSavingAppointment(false);
    }
  }

  function handleSaveAppointment() {
    const appointmentAt = fromDatetimeLocalValue(appointmentDraft);
    persistAppointment(appointmentAt, appointmentAt ? appointmentStatusDraft : null);
  }

  function handleClearAppointment() {
    setAppointmentDraft("");
    persistAppointment(null, null);
  }

  function handleRemoveTag(tag: string) {
    persistTags(conversation.tags.filter((t) => t !== tag));
  }

  async function handleModeChange(mode: "AI" | "HUMAN") {
    onModeChanged(conversation.id, mode);
    await fetch(`/api/mode/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        console.error("Error enviando mensaje:", res.status, res.statusText, errorBody);
        return;
      }
      const data = await res.json();
      setDraft("");
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId,
          conversation_id: conversation.id,
          role: "human",
          content,
          created_at: Math.floor(Date.now() / 1000),
        },
      ]);
      // El servidor ya pausó la IA (ver setMode en la ruta); reflejamos el
      // cambio localmente al toque en vez de esperar el próximo poll de 2s.
      onModeChanged(conversation.id, "HUMAN");
    } catch (err) {
      console.error("Falla de red enviando mensaje:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    await onDelete(conversation.id);
    setConfirmingDelete(false);
  }

  function toggleMessageSelect(id: number) {
    setSelectedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function roleLabel(role: MessageItem["role"]): string {
    if (role === "user") return "Cliente";
    if (role === "human") return "Agente";
    return "IA";
  }

  function formatMessageForContext(message: MessageItem): string {
    const when = new Date(message.created_at * 1000).toLocaleString("es-MX");
    return `### ${roleLabel(message.role)} — ${when}\n\n${message.content.trim()}`;
  }

  async function handleAddMessagesToContext() {
    if (addingToContext || selectedMessageIds.length === 0) return;

    const selected = messages
      .filter((message) => selectedMessageIds.includes(message.id))
      .sort((a, b) => a.created_at - b.created_at || a.id - b.id);

    if (selected.length === 0) return;

    const filename = `mensajes-conv-${conversation.id}.md`;
    const contactLabel = conversation.name || conversation.phone;
    const chunk = selected.map(formatMessageForContext).join("\n\n---\n\n");

    setAddingToContext(true);
    setContextFeedback(null);
    try {
      let existing = "";
      const currentRes = await fetch(`/api/context/${encodeURIComponent(filename)}`);
      if (currentRes.ok) {
        const data = await currentRes.json().catch(() => null);
        existing = typeof data?.content === "string" ? data.content.trim() : "";
      }

      const header =
        existing ||
        `# Mensajes de contexto — ${contactLabel}\n\nTeléfono: ${conversation.phone}\n`;
      const content = `${header}\n\n## Agregado ${new Date().toLocaleString("es-MX")}\n\n${chunk}\n`;

      const uploadRes = await fetch("/api/context/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content }),
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null);
        throw new Error(err?.error ?? "No se pudo guardar el archivo de contexto");
      }

      const attachedRes = await fetch(`/api/conversations/${conversation.id}/context`);
      const attachedData = attachedRes.ok ? await attachedRes.json().catch(() => null) : null;
      const alreadyAttached: string[] = Array.isArray(attachedData?.files) ? attachedData.files : [];

      // Si aún no hay archivos adjuntos, al adjuntar uno solo el bot deja de usar
      // el contexto global. Conservamos los demás archivos activos.
      if (alreadyAttached.length === 0) {
        const allRes = await fetch("/api/context");
        const allData = allRes.ok ? await allRes.json().catch(() => null) : null;
        const allFiles: string[] = Array.isArray(allData?.files)
          ? allData.files.map((f: { filename: string }) => f.filename)
          : [];
        for (const other of allFiles) {
          if (other === filename) continue;
          await fetch(`/api/conversations/${conversation.id}/context`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: other }),
          });
        }
      }

      const attachRes = await fetch(`/api/conversations/${conversation.id}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (!attachRes.ok) {
        const err = await attachRes.json().catch(() => null);
        throw new Error(err?.error ?? "No se pudo adjuntar el contexto a la conversación");
      }

      setSelectedMessageIds([]);
      setSelectingContext(false);
      setContextFeedback(
        `${selected.length} mensaje${selected.length === 1 ? "" : "s"} agregado${
          selected.length === 1 ? "" : "s"
        } al contexto`
      );
    } catch (err) {
      setContextFeedback(err instanceof Error ? err.message : "Error agregando al contexto");
    } finally {
      setAddingToContext(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-col gap-2 border-b border-gray-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 md:hidden"
            >
              ←
            </button>
          )}
          <ChatAvatar
            id={conversation.id}
            name={conversation.name}
            phone={conversation.phone}
            size={36}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {conversation.name || conversation.phone}
            </p>
            <p className="truncate text-xs text-gray-500">{conversation.phone}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <ModeToggle mode={conversation.mode} onChange={handleModeChange} />
          <button
            type="button"
            onClick={() => {
              setSelectingContext((prev) => !prev);
              setSelectedMessageIds([]);
              setContextFeedback(null);
            }}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${
              selectingContext
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {selectingContext ? "Cancelar" : "Al contexto"}
          </button>
          <button
            type="button"
            onClick={() => setMergePickerOpen(true)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
          >
            Fusionar
          </button>
          <button
            type="button"
            onClick={() => setCrmVisible((prev) => !prev)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
          >
            {crmVisible ? "Ocultar CRM" : "CRM"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-red-200 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
          >
            Borrar
          </button>
        </div>
      </div>

      {conversation.mode === "HUMAN" && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <span>
            La IA está pausada
            {conversation.human_mode_expires_at
              ? ` — se reactiva automáticamente a las ${formatTime(
                  conversation.human_mode_expires_at
                )} si no hay más actividad.`
              : "."}
          </span>
          <button
            type="button"
            onClick={() => handleModeChange("AI")}
            className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 font-medium text-amber-700 hover:bg-amber-100"
          >
            Reactivar IA ahora
          </button>
        </div>
      )}

      {selectingContext && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-800">
          <span>
            Seleccioná mensajes y agregalos al contexto del bot para esta conversación.
            {selectedMessageIds.length > 0
              ? ` (${selectedMessageIds.length} seleccionados)`
              : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddMessagesToContext}
              disabled={addingToContext || selectedMessageIds.length === 0}
              className="rounded-md bg-indigo-600 px-2.5 py-1 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {addingToContext ? "Agregando..." : "Agregar al contexto"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedMessageIds(messages.map((m) => m.id))}
              className="rounded-md border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Todos
            </button>
          </div>
        </div>
      )}

      {contextFeedback && (
        <div
          className={`border-b px-4 py-2 text-xs ${
            contextFeedback.toLowerCase().includes("error") ||
            contextFeedback.toLowerCase().includes("no se pudo")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {contextFeedback}
        </div>
      )}

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        {!crmVisible ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            CRM oculto. Hacé clic en &quot;Mostrar CRM&quot; para ver etiquetas y notas internas.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
          {conversation.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-indigo-400 hover:text-indigo-700"
                aria-label={`Quitar etiqueta ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="+ etiqueta"
            className="w-24 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs focus:border-indigo-400 focus:outline-none"
          />
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-gray-500">
              Notas internas
            </summary>
            <div className="mt-2 flex gap-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={2}
                placeholder="Notas internas sobre este contacto (no las ve el cliente)..."
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="self-start rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {savingNotes ? "..." : "Guardar"}
              </button>
            </div>
          </details>

          <details className="mt-2" open={Boolean(conversation.appointment_at)}>
            <summary className="cursor-pointer text-xs font-medium text-gray-500">
              Cita / turno
              {conversation.appointment_at ? (
                <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                  {new Date(conversation.appointment_at * 1000).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
            </summary>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-[10px] font-medium text-gray-500">
                Fecha y hora
                <input
                  type="datetime-local"
                  value={appointmentDraft}
                  onChange={(e) => setAppointmentDraft(e.target.value)}
                  className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col text-[10px] font-medium text-gray-500">
                Estado
                <select
                  value={appointmentStatusDraft}
                  onChange={(e) => setAppointmentStatusDraft(e.target.value as AppointmentStatus)}
                  className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
                >
                  {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleSaveAppointment}
                disabled={savingAppointment || !appointmentDraft}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {savingAppointment ? "..." : "Guardar"}
              </button>
              {conversation.appointment_at ? (
                <button
                  type="button"
                  onClick={handleClearAppointment}
                  disabled={savingAppointment}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Quitar
                </button>
              ) : null}
            </div>
          </details>
        </>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={messagesRef}
          className="h-full space-y-3 overflow-y-auto bg-gray-50 px-3 py-3 sm:px-6 sm:py-4"
        >
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              createdAt={m.created_at}
              selectable={selectingContext}
              selected={selectedMessageIds.includes(m.id)}
              onToggleSelect={() => toggleMessageSelect(m.id)}
            />
          ))}
        </div>

        {!isNearBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 right-6 rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-800"
          >
            ↓ Ir al final
          </button>
        )}
      </div>

      <div className="border-t border-gray-200 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Escribí un mensaje..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="rounded-md bg-amber-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>

      {mergePickerOpen && (
        <MergePicker
          currentConversationId={conversation.id}
          onClose={() => setMergePickerOpen(false)}
          onMerged={onMerged}
        />
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
            <p className="text-sm text-gray-700">
              ¿Seguro que querés borrar esta conversación? Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
