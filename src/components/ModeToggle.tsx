"use client";

interface ModeToggleProps {
  mode: "AI" | "HUMAN";
  onChange: (mode: "AI" | "HUMAN") => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 text-sm font-medium">
      <button
        type="button"
        onClick={() => onChange("AI")}
        className={`rounded-full px-3 py-1 transition-colors ${
          mode === "AI" ? "bg-emerald-500 text-white" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        IA
      </button>
      <button
        type="button"
        onClick={() => onChange("HUMAN")}
        className={`rounded-full px-3 py-1 transition-colors ${
          mode === "HUMAN" ? "bg-amber-500 text-white" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Humano
      </button>
    </div>
  );
}
