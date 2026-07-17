interface MessageBubbleProps {
  role: "user" | "assistant" | "human";
  content: string;
  createdAt: number;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({
  role,
  content,
  createdAt,
  selectable = false,
  selected = false,
  onToggleSelect,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const isHuman = role === "human";

  const bubbleClass = isUser
    ? "bg-white border border-gray-200 text-gray-900"
    : isHuman
      ? "bg-amber-500 text-white"
      : "bg-emerald-500 text-white";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "justify-start" : "justify-end"}`}>
      {selectable && isUser && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-3 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600"
          aria-label="Seleccionar mensaje para contexto"
        />
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${bubbleClass} ${
          selectable
            ? `cursor-pointer ring-offset-1 ${selected ? "ring-2 ring-indigo-400" : "hover:ring-1 hover:ring-indigo-200"}`
            : ""
        }`}
        onClick={selectable ? onToggleSelect : undefined}
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={
          selectable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleSelect?.();
                }
              }
            : undefined
        }
      >
        {!isUser && (
          <p className="mb-0.5 text-[10px] font-semibold text-white/80">
            {isHuman ? "Agente" : "IA"}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">{content}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            isUser ? "text-gray-400" : "text-white/70"
          }`}
        >
          {formatTime(createdAt)}
        </p>
      </div>
      {selectable && !isUser && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-3 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600"
          aria-label="Seleccionar mensaje para contexto"
        />
      )}
    </div>
  );
}
