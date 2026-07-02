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
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
        Todavía no hay conversaciones. Escribile al número conectado para empezar.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-gray-100 ${
              selectedId === c.id ? "bg-gray-100" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-gray-900">
                {c.name || c.phone}
              </span>
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
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-gray-500">
                {c.last_message_preview || "Sin mensajes"}
              </span>
              <span className="shrink-0 text-[10px] text-gray-400">
                {relativeTime(c.last_message_at)}
              </span>
            </div>
            {c.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
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
        </li>
      ))}
    </ul>
  );
}
