"use client";

import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { ConversationListItem } from "./ConversationList";
import {
  CRM_STAGES,
  getConversationStageFromTags,
  withStage,
  type CrmStage,
} from "@/lib/crm-stages";

type CrmPatch = Partial<Pick<ConversationListItem, "notes" | "tags">>;

interface CrmBoardProps {
  conversations: ConversationListItem[];
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onCrmUpdated: (id: number, patch: CrmPatch) => void;
}

function getConversationStage(conversation: ConversationListItem): CrmStage {
  return getConversationStageFromTags(conversation.tags);
}

function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "Sin actividad";
  return new Date(unixSeconds * 1000).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

function previewAmount(conversation: ConversationListItem): string | null {
  const source = `${conversation.notes} ${conversation.last_message_preview ?? ""}`;
  const match = source.match(/\$\s?[\d,.]+/);
  return match?.[0] ?? null;
}

interface CrmCardProps {
  conversation: ConversationListItem;
  stage: (typeof CRM_STAGES)[number];
  saving: boolean;
  dragging: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateStage: (conversation: ConversationListItem, stage: CrmStage) => void;
  onCrmUpdated: (id: number, patch: CrmPatch) => void;
  onDragStart: (event: DragEvent<HTMLElement>, conversationId: number) => void;
  onDragEnd: () => void;
}

function CrmCard({
  conversation,
  stage,
  saving,
  dragging,
  onSelect,
  onDelete,
  onUpdateStage,
  onCrmUpdated,
  onDragStart,
  onDragEnd,
}: CrmCardProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(conversation.notes);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!notesOpen) setNotesDraft(conversation.notes);
  }, [conversation.notes, notesOpen]);

  const amount = previewAmount(conversation);
  const notesDirty = notesDraft !== conversation.notes;

  async function handleSaveNotes() {
    if (savingNotes || !notesDirty) return;
    setSavingNotes(true);
    const previous = conversation.notes;
    onCrmUpdated(conversation.id, { notes: notesDraft });
    try {
      const res = await fetch(`/api/crm/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) {
        onCrmUpdated(conversation.id, { notes: previous });
        setNotesDraft(previous);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <article
      draggable={!saving && !notesOpen}
      onDragStart={(event) => onDragStart(event, conversation.id)}
      onDragEnd={onDragEnd}
      className={`rounded-lg border-l-4 border-blue-500 bg-white p-3 shadow-sm transition ${
        notesOpen ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${dragging ? "opacity-50 ring-2 ring-blue-300" : ""}`}
    >
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${stage.badgeClass}`}
      >
        {stage.label}
      </span>

      <div className="mt-1">
        <h3 className="truncate text-sm font-bold text-slate-800">
          {conversation.name || conversation.phone}
        </h3>
        <p className="text-[11px] text-slate-500">{conversation.phone}</p>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-800">
        {amount ?? formatDate(conversation.last_message_at)}
      </p>

      {conversation.last_message_preview && (
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
          {conversation.last_message_preview}
        </p>
      )}

      {!notesOpen && conversation.notes.trim() && (
        <p className="mt-2 line-clamp-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          {conversation.notes}
        </p>
      )}

      {notesOpen ? (
        <div
          className="mt-3 space-y-2"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            rows={3}
            placeholder="Notas internas del pedido..."
            className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-400"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={savingNotes || !notesDirty}
              className="rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {savingNotes ? "Guardando..." : "Guardar nota"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNotesDraft(conversation.notes);
                setNotesOpen(false);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="mt-3 w-full rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1.5 text-left text-[11px] font-medium text-amber-800 hover:bg-amber-50"
        >
          {conversation.notes.trim() ? "Editar nota" : "+ Agregar nota"}
        </button>
      )}

      <select
        value={stage.id}
        disabled={saving}
        onChange={(event) => onUpdateStage(conversation, event.target.value as CrmStage)}
        className="mt-3 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 outline-none focus:border-blue-400"
      >
        {CRM_STAGES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
        <button
          type="button"
          onClick={() => onSelect(conversation.id)}
          className="rounded-md border border-slate-200 px-2 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          Ver
        </button>
        <button
          type="button"
          onClick={() => onSelect(conversation.id)}
          className="rounded-md bg-blue-500 px-2 py-2 font-semibold text-white hover:bg-blue-600"
        >
          Modificar
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("¿Borrar esta conversación? Esta acción no se puede deshacer.")) {
              onDelete(conversation.id);
            }
          }}
          className="rounded-md bg-red-500 px-2 py-2 font-semibold text-white hover:bg-red-600"
        >
          Borrar
        </button>
      </div>
    </article>
  );
}

export default function CrmBoard({
  conversations,
  onSelect,
  onDelete,
  onCrmUpdated,
}: CrmBoardProps) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<CrmStage, ConversationListItem[]>();
    for (const stage of CRM_STAGES) map.set(stage.id, []);

    for (const conversation of conversations) {
      map.get(getConversationStage(conversation))?.push(conversation);
    }

    for (const stageConversations of map.values()) {
      stageConversations.sort(
        (a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0) || b.id - a.id
      );
    }

    return map;
  }, [conversations]);

  async function updateStage(conversation: ConversationListItem, stage: CrmStage) {
    const currentStage = getConversationStage(conversation);
    if (stage === currentStage || savingId === conversation.id) return;

    const nextTags = withStage(conversation.tags, stage);

    setSavingId(conversation.id);
    onCrmUpdated(conversation.id, { tags: nextTags });
    try {
      const res = await fetch(`/api/crm/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (!res.ok) {
        onCrmUpdated(conversation.id, { tags: conversation.tags });
      }
    } finally {
      setSavingId(null);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, conversationId: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(conversationId));
    setDraggingId(conversationId);
  }

  function handleDrop(event: DragEvent<HTMLElement>, stage: CrmStage) {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/plain"));
    const conversation = conversations.find((item) => item.id === id);
    setDraggingId(null);
    setOverStage(null);
    if (!conversation) return;
    updateStage(conversation, stage);
  }

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
        <h1 className="text-lg font-bold text-slate-800 sm:text-xl">Pedidos por estado</h1>
        <p className="mt-1 text-xs text-slate-500">
          En móvil deslizá entre columnas. Arrastrá o usá el selector para cambiar el estado.
        </p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory p-3 sm:p-4">
        <div className="flex h-full min-w-max gap-3 sm:grid sm:min-w-[980px] sm:grid-cols-5 sm:gap-4">
          {CRM_STAGES.map((stage) => {
            const items = grouped.get(stage.id) ?? [];
            return (
              <section
                key={stage.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOverStage(stage.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setOverStage(null);
                  }
                }}
                onDrop={(event) => handleDrop(event, stage.id)}
                className={`h-full w-[85vw] max-w-xs shrink-0 snap-center overflow-y-auto rounded-xl p-2 transition sm:h-auto sm:min-h-[calc(100dvh-9rem)] sm:w-auto sm:max-w-none ${
                  overStage === stage.id
                    ? "bg-blue-100 ring-2 ring-blue-300"
                    : "bg-slate-200/70"
                }`}
              >
                <div className="sticky top-0 z-10 mb-2 flex items-center justify-between border-b border-slate-300 bg-slate-200/90 pb-2 backdrop-blur-sm">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                    {stage.label}
                  </h2>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-2 pb-[env(safe-area-inset-bottom)]">
                  {items.map((conversation) => (
                    <CrmCard
                      key={conversation.id}
                      conversation={conversation}
                      stage={stage}
                      saving={savingId === conversation.id}
                      dragging={draggingId === conversation.id}
                      onSelect={onSelect}
                      onDelete={onDelete}
                      onUpdateStage={updateStage}
                      onCrmUpdated={onCrmUpdated}
                      onDragStart={handleDragStart}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverStage(null);
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
