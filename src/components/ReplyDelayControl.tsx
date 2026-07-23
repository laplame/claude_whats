"use client";

import { useEffect, useState } from "react";

export default function ReplyDelayControl() {
  const [delaySec, setDelaySec] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("No se pudo cargar el ajuste");
        const data = await res.json();
        if (!cancelled) {
          setDelaySec(Number(data.reply_delay_sec) || 2);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: number) {
    setDelaySec(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_delay_sec: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No se pudo guardar");
      }
      const data = await res.json();
      setDelaySec(Number(data.reply_delay_sec) || next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-gray-100 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-gray-800">Delay de respuesta</p>
      <p className="mt-0.5 text-[10px] leading-snug text-gray-500">
        Pausa natural antes de enviar (1–4 s). Textos largos muestran “escribiendo…” más tiempo.
      </p>
      {loading ? (
        <p className="mt-2 text-[10px] text-gray-400">Cargando…</p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={delaySec}
            disabled={saving}
            onChange={(e) => save(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-emerald-600"
            aria-label="Delay de respuesta en segundos"
          />
          <span className="w-8 text-right text-[11px] font-semibold tabular-nums text-gray-800">
            {delaySec}s
          </span>
        </div>
      )}
      {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
      {saving ? <p className="mt-1 text-[10px] text-gray-400">Guardando…</p> : null}
    </div>
  );
}
