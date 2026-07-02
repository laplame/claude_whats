interface MessageBubbleProps {
  role: "user" | "assistant" | "human";
  content: string;
  createdAt: number;
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
  const isUser = role === "user";
  const isHuman = role === "human";

  const bubbleClass = isUser
    ? "bg-white border border-gray-200 text-gray-900"
    : isHuman
      ? "bg-amber-500 text-white"
      : "bg-emerald-500 text-white";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${bubbleClass}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{content}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            isUser ? "text-gray-400" : "text-white/70"
          }`}
        >
          {formatTime(createdAt)}
        </p>
      </div>
    </div>
  );
}
