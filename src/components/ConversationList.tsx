"use client";

export interface ConversationListItem {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  notes: string;
  tags: string[];
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface ConversationListProps {
  conversations: ConversationListItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

function relativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) return "";
  const diffMs = Date.now() - unixSeconds * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
        Todavía no hay conversaciones. Escribile al número conectado para empezar.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Chats</p>
          <p className="text-[11px] text-gray-500">{conversations.length} conversaciones</p>
        </div>
      </div>

      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
        {conversations.map((c) => (
          <li key={c.id}>
            <div className={`group flex items-start justify-between gap-2 px-3 py-3 transition ${
                selectedId === c.id ? "bg-gray-100" : "hover:bg-gray-50"
              }`}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">
                      {c.name || c.phone}
                    </span>
                    {c.name && (
                      <span className="block truncate text-[11px] text-gray-500">{c.phone}</span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      c.mode === "AI"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {c.mode === "AI" ? "IA" : "Humano"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-500">
                    {c.last_message_preview || "Sin mensajes"}
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {relativeTime(c.last_message_at)}
                  </span>
                </div>
                {c.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!confirm("¿Borrar esta conversación? Esta acción no se puede deshacer.")) {
                    return;
                  }
                  onDelete(c.id);
                }}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 group-hover:inline-flex"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
