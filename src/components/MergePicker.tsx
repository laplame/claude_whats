"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatAvatar } from "@/lib/avatar";

interface CandidateConversation {
  id: number;
  phone: string;
  name: string | null;
}

interface MergePickerProps {
  currentConversationId: number;
  onClose: () => void;
  onMerged: (droppedId: number) => void;
}

export default function MergePicker({
  currentConversationId,
  onClose,
  onMerged,
}: MergePickerProps) {
  const [candidates, setCandidates] = useState<CandidateConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/conversations");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const list = (data.conversations || []) as CandidateConversation[];
      setCandidates(list.filter((c) => c.id !== currentConversationId));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentConversationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      `${c.name ?? ""} ${c.phone}`.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  async function handleMerge(dropId: number) {
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId: currentConversationId, dropId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "No se pudo fusionar.");
        return;
      }
      onMerged(dropId);
      onClose();
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex max-h-[80vh] w-96 flex-col rounded-lg bg-white shadow-lg">
        <div className="border-b border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-900">Fusionar conversaciones</p>
          <p className="mt-1 text-xs text-gray-500">
            Elegí la conversación duplicada de esta misma persona. Sus mensajes y datos de CRM
            se van a mover acá y esa fila va a desaparecer.
          </p>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="mt-3 w-full rounded-full border border-gray-200 px-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-center text-xs text-gray-400">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-gray-400">No hay conversaciones para fusionar.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={merging}
                    onClick={() => handleMerge(c.id)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChatAvatar id={c.id} name={c.name} phone={c.phone} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-900">
                        {c.name || c.phone}
                      </span>
                      {c.name && (
                        <span className="block truncate text-[11px] text-gray-500">{c.phone}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="border-t border-red-100 bg-red-50 p-2 text-center text-xs text-red-600">{error}</p>}

        <div className="flex justify-end border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
