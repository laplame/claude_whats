"use client";

import { useEffect, useState } from "react";

interface MarkdownEditorProps {
  filename: string;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  "Ordená secciones y aclará viñetas sin inventar datos",
  "Completá huecos con [COMPLETAR] donde falte info",
  "Agregá FAQs útiles sin inventar precios",
  "Acortá el texto y dejá solo lo esencial para ventas",
];

export default function MarkdownEditor({ filename, onClose }: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchFile() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/context/${encodeURIComponent(filename)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? res.statusText);
        }
        const data = await res.json();
        if (mounted) {
          setContent(data.content ?? "");
        }
      } catch (err) {
        if (mounted) setError(String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchFile();
    return () => {
      mounted = false;
    };
  }, [filename]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/context/${encodeURIComponent(filename)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? res.statusText);
      }
      setAiHint("Guardado.");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function runAi(mode: "improve" | "generate") {
    setAiBusy(true);
    setError(null);
    setAiHint(null);
    try {
      const res = await fetch("/api/context/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          instruction,
          content: mode === "improve" ? content : "",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? res.statusText);
      }
      const markdown = typeof data?.markdown === "string" ? data.markdown : "";
      if (!markdown.trim()) {
        throw new Error("la IA no devolvió contenido");
      }
      setContent(markdown);
      setAiHint(
        data?.provider
          ? `MD actualizado con ${data.provider}. Revisá y guardá.`
          : "MD actualizado. Revisá y guardá."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 md:hidden"
          >
            ←
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{filename}</p>
            <p className="text-xs text-gray-500">Editor de contexto</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              aiOpen
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {aiOpen ? "Ocultar IA" : "IA"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 md:inline-flex"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || aiBusy}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {aiOpen ? (
        <div className="border-b border-emerald-100 bg-emerald-50/60 px-3 py-3 sm:px-6">
          <p className="text-xs font-semibold text-emerald-900">Editor con IA</p>
          <p className="mt-0.5 text-[11px] text-emerald-800/80">
            Pedile que genere o mejore el MD. No inventa precios: usa{" "}
            <code className="text-[10px]">[COMPLETAR]</code> si falta un dato.
          </p>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            placeholder="Ej: Vendemos café tostado. Precio 1kg $280. Envíos CDMX. Horario lun–vie 9–18. FAQs sobre molienda..."
            className="mt-2 w-full resize-y rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 focus:outline-none sm:text-sm"
            disabled={aiBusy || loading}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={aiBusy || loading}
                onClick={() => setInstruction(prompt)}
                className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              >
                {prompt.length > 42 ? `${prompt.slice(0, 40)}…` : prompt}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={aiBusy || loading || !instruction.trim()}
              onClick={() => runAi("generate")}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {aiBusy ? "Generando…" : "Generar MD"}
            </button>
            <button
              type="button"
              disabled={aiBusy || loading || (!content.trim() && !instruction.trim())}
              onClick={() => runAi("improve")}
              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
            >
              {aiBusy ? "Mejorando…" : "Mejorar MD actual"}
            </button>
          </div>
          {aiHint ? <p className="mt-2 text-[11px] font-medium text-emerald-800">{aiHint}</p> : null}
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden p-3 sm:p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Cargando contenido...
          </div>
        ) : error && !content ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Error: {error}
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={aiBusy}
              className="h-full w-full resize-none rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none disabled:opacity-60 sm:p-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
