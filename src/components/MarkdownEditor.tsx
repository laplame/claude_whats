"use client";

import { useEffect, useState } from "react";

interface MarkdownEditorProps {
  filename: string;
  onClose: () => void;
}

export default function MarkdownEditor({ filename, onClose }: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{filename}</p>
          <p className="text-xs text-gray-500">Editor de MD</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">Cargando contenido...</div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">Error: {error}</div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-full w-full resize-none rounded-md border border-gray-300 bg-gray-50 p-4 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
