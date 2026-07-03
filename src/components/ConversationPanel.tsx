"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";

export interface ConversationSummary {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  notes: string;
  tags: string[];
}

type CrmPatch = Partial<Pick<ConversationSummary, "notes" | "tags">>;

interface MessageItem {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface ConversationPanelProps {
  conversation: ConversationSummary;
  onDeleted: () => void;
  onModeChanged: (id: number, mode: "AI" | "HUMAN") => void;
  onCrmUpdated: (id: number, patch: CrmPatch) => void;
}

export default function ConversationPanel({
  conversation,
  onDeleted,
  onModeChanged,
  onCrmUpdated,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notesDraft, setNotesDraft] = useState(conversation.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [scrollProgress, setScrollProgress] = useState(100);
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (!container) return;

    if (scrollProgress === 100) {
      container.scrollTop = container.scrollHeight;
      setScrollProgress(100);
    }
  }, [messages, scrollProgress]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    const updateProgress = () => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) {
        setScrollProgress(100);
        return;
      }
      setScrollProgress(Math.round((container.scrollTop / maxScroll) * 100));
    };

    container.addEventListener("scroll", updateProgress);
    updateProgress();
    return () => container.removeEventListener("scroll", updateProgress);
  }, []);

  // Solo reseteamos el borrador de notas al cambiar de conversación, no en
  // cada refresco de polling — si no, se perdería lo que el usuario está
  // escribiendo cada 2 segundos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNotesDraft(conversation.notes);
  }, [conversation.id]);

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
    } catch (err) {
      console.error("Falla de red enviando mensaje:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    setConfirmingDelete(false);
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {conversation.name || conversation.phone}
          </p>
          <p className="text-xs text-gray-500">{conversation.phone}</p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle mode={conversation.mode} onChange={handleModeChange} />
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-6 py-3">
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
      </div>

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>Historia de mensajes</span>
          <span>{scrollProgress === 100 ? "Abajo" : `Top ${100 - scrollProgress}%`}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={scrollProgress}
          onChange={(e) => {
            const value = Number(e.target.value);
            const container = messagesRef.current;
            if (!container) return;
            const maxScroll = container.scrollHeight - container.clientHeight;
            container.scrollTop = Math.round((value / 100) * maxScroll);
            setScrollProgress(value);
          }}
          className="mt-2 w-full accent-amber-500"
        />
      </div>

      <div ref={messagesRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-6 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} createdAt={m.created_at} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 px-6 py-4">
        {conversation.mode === "AI" ? (
          <p className="rounded-md bg-gray-100 px-4 py-3 text-center text-xs text-gray-500">
            El bot responde automáticamente. Cambiá a modo Humano para escribir vos.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Escribí un mensaje..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        )}
      </div>

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
