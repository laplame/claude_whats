"use client";

import { useEffect, useState } from "react";

interface ContextFile {
  filename: string;
  added_at: number;
  size: number;
  source?: string;
}
interface Props {
  selectedConversationId: number | null;
  selectedFile: string | null;
  onSelectFile: (filename: string) => void;
  onDeleteFile?: (filename: string) => void;
}

export default function ContextManager({
  selectedConversationId,
  selectedFile,
  onSelectFile,
  onDeleteFile,
}: Props) {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creatingAi, setCreatingAi] = useState(false);
  const [attached, setAttached] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(true);

  async function fetchFiles() {
    const res = await fetch("/api/context");
    if (!res.ok) return;
    const data = await res.json();
    setFiles(data.files || []);
  }

  useEffect(() => {
    // fetchFiles es async (su setState ocurre después del await, no
    // sincrónicamente); se reutiliza en otros handlers, así que no puede
    // vivir solo dentro del efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles();
    const id = setInterval(fetchFiles, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fetchAttached() {
      if (!selectedConversationId) {
        setAttached([]);
        return;
      }

      const res = await fetch(`/api/conversations/${selectedConversationId}/context`);
      if (!res.ok || !mounted) return;
      const data = await res.json().catch(() => null);
      if (mounted) setAttached(data.files || []);
    }

    fetchAttached();
    return () => {
      mounted = false;
    };
  }, [selectedConversationId]);

  function formatDate(unix: number) {
    return new Date(unix * 1000).toLocaleString();
  }

  async function handleCreateWithAi() {
    setCreatingAi(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `contexto-ia-${stamp}.md`;
      const starter = `# Contexto del negocio\n\n## Qué vendemos\n- [COMPLETAR]\n\n## Precios y planes\n- [COMPLETAR]\n\n## Políticas\n- [COMPLETAR]\n\n## Guion de atención\n1. [COMPLETAR]\n\n## Preguntas frecuentes\n- [COMPLETAR]\n\n## Cuándo derivar a un humano\n- [COMPLETAR]\n`;
      const res = await fetch("/api/context/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content: starter }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(`Error: ${data?.error ?? res.statusText}`);
        return;
      }
      await fetchFiles();
      onSelectFile(data?.filename || filename);
      setCollapsed(false);
    } finally {
      setCreatingAi(false);
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return;

    const text = await f.text();
    setUploading(true);
    try {
      const res = await fetch("/api/context/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: f.name, content: text }),
      });
      if (res.ok) fetchFiles();
    } finally {
      setUploading(false);
      try {
        if (input) input.value = "";
      } catch {
        // ignore
      }
    }
  }

  async function handleDelete(filename: string, source?: string) {
    const message =
      source === "project"
        ? `¿Quitar ${filename} del contexto? El archivo del repo no se borra del disco.`
        : `¿Borrar ${filename}? Esta acción no se puede deshacer.`;
    if (!confirm(message)) return;

    try {
      const res = await fetch(`/api/context/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(`Error borrando: ${data?.error ?? res.statusText}`);
        return;
      }
      setAttached((prev) => prev.filter((x) => x !== filename));
      onDeleteFile?.(filename);
      fetchFiles();
    } catch (err) {
      alert(`Error de red: ${String(err)}`);
    }
  }

  return (
    <div className="p-3">
      <div className="mb-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Contexto</p>
            <p className="text-[11px] text-gray-500">MD + archivos en uso</p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            {collapsed ? "Mostrar" : "Ocultar"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">
              {uploading ? "Subiendo..." : "Subir MD"}
              <input type="file" accept=".md" onChange={handleFileInput} className="hidden" />
            </label>
            <button
              type="button"
              onClick={handleCreateWithAi}
              disabled={creatingAi || uploading}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {creatingAi ? "Creando…" : "Nuevo con IA"}
            </button>
          </div>
          <span className="text-[10px] text-gray-500">{files.length} archivos</span>
        </div>
      </div>

      {!collapsed ? (
        <div className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          {files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
              No hay archivos de contexto.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[32rem] overflow-auto text-xs">
              {files.map((f) => (
                <li
                  key={`${f.source || 'project'}:${f.filename}`}
                  className={`rounded-xl border px-3 py-3 transition ${
                    selectedFile === f.filename ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectFile(f.filename)}
                      className="flex-1 min-w-0 text-left text-sm font-medium text-gray-900"
                    >
                      <span className="truncate block">{f.filename}</span>
                    </button>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                      {f.source ?? 'project'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                    <span>{formatDate(f.added_at)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedConversationId ? (
                      attached.includes(f.filename) ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/conversations/${selectedConversationId}/context`, {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ filename: f.filename }),
                            });
                            if (res.ok) {
                              setAttached((prev) => prev.filter((x) => x !== f.filename));
                            } else {
                              const data = await res.json().catch(() => null);
                              alert(`Error: ${data?.error ?? res.statusText}`);
                            }
                          }}
                          className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700"
                        >
                          Quitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/conversations/${selectedConversationId}/context`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ filename: f.filename }),
                            });
                            if (res.ok) {
                              setAttached((prev) => [...prev, f.filename]);
                            } else {
                              const data = await res.json().catch(() => null);
                              alert(`Error: ${data?.error ?? res.statusText}`);
                            }
                          }}
                          className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700"
                        >
                          Adjuntar
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => alert('Seleccioná una conversación para adjuntar')}
                        className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600"
                      >
                        Adjuntar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(f.filename, f.source)}
                      className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600"
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-2 text-[11px] text-gray-500 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">Contexto</p>
              <p className="mt-1 text-[10px] text-gray-500">{files.length} archivos • {selectedConversationId ? attached.length : 0} adjuntos</p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              Abrir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
