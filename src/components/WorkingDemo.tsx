"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
};

type CrmStage = "LEAD" | "MKTQL" | "SALES" | "CLOSED";

const STAGE_META: Record<CrmStage, { label: string; className: string }> = {
  LEAD: { label: "LEAD", className: "bg-amber-50 text-amber-800 border-amber-200" },
  MKTQL: { label: "MKTQL", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  SALES: { label: "SALES", className: "bg-sky-50 text-sky-800 border-sky-200" },
  CLOSED: { label: "CLOSED", className: "bg-[#1f3a28] text-[#e8efe9] border-[#1f3a28]" },
};

const STAGE_ORDER: CrmStage[] = ["LEAD", "MKTQL", "SALES", "CLOSED"];

const GREETING =
  "Hola 👋 Soy el asistente de WhatsClaude. Te muestro cómo atiende la IA de punta a punta. ¿Qué querés resolver con tu WhatsApp?";

const SUGGESTIONS = [
  "¿Qué es WhatsClaude?",
  "¿Cómo funciona?",
  "¿Cuánto cuesta?",
  "Quiero activar mi cuenta",
];

const CLOSE_HINTS = ["activar", "empezar", "contratar", "comprar", "asesor", "closer", "cerrar"];
const SALES_HINTS = ["precio", "cuánto", "cuanto", "plan", "demo", "prueba", "comprar"];
const MKTQL_HINTS = ["lead", "calificar", "clientes", "ventas", "whatsapp", "cómo funciona", "como funciona"];

function inferStage(current: CrmStage, text: string): CrmStage {
  const t = text.toLowerCase();
  let next: CrmStage = current;
  if (MKTQL_HINTS.some((k) => t.includes(k))) next = "MKTQL";
  if (SALES_HINTS.some((k) => t.includes(k))) next = "SALES";
  if (CLOSE_HINTS.some((k) => t.includes(k))) next = "CLOSED";
  return STAGE_ORDER.indexOf(next) > STAGE_ORDER.indexOf(current) ? next : current;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-hidden>
      <span className="demo-dot h-1.5 w-1.5 rounded-full bg-[#7a9b7e]" />
      <span className="demo-dot demo-dot-2 h-1.5 w-1.5 rounded-full bg-[#7a9b7e]" />
      <span className="demo-dot demo-dot-3 h-1.5 w-1.5 rounded-full bg-[#7a9b7e]" />
    </div>
  );
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function WorkingDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<CrmStage>("LEAD");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startDemo = () => {
    setStarted(true);
    setError(null);
    setStage("LEAD");
    setMessages([{ id: uid(), role: "assistant", text: GREETING }]);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    setError(null);
    const userMsg: ChatMessage = { id: uid(), role: "user", text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setStage((prev) => inferStage(prev, text));
    setLoading(true);

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al generar la respuesta.");

      const replyText: string = data.reply ?? "";
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: replyText }]);
      setStage((prev) => inferStage(prev, `${text} ${replyText}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading, error]);

  const stageMeta = STAGE_META[stage];
  const closed = stage === "CLOSED";

  return (
    <section
      id="demo"
      className="relative border-t border-[#1f3a28]/15 bg-[#f3f7f3]/80 px-5 py-20 backdrop-blur sm:px-10 lg:px-16"
    >
      <div className="mx-auto grid w-full max-w-7xl items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
            Working demo · IA real
          </p>
          <h2 className="mt-3 max-w-xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
            Chateá con la misma IA que cierra tus ventas.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[#3d5344]">
            Este demo usa la IA de WhatsClaude y responde con el{" "}
            <Link href="/faq" className="font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4">
              FAQ oficial
            </Link>
            : el mismo conocimiento que usa el closer para explicar y cerrar.
            Escribí lo que quieras; la IA califica y te lleva al alta.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-[#3d5344]">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5f8f63]" />
              Respuestas generadas en vivo, no guionadas
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5f8f63]" />
              Estados LEAD → MKTQL → SALES → CLOSED en vivo
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5f8f63]" />
              Fallback automático si un proveedor falla
            </li>
          </ul>

          {!started && (
            <button
              type="button"
              onClick={startDemo}
              className="landing-btn-dark mt-8 inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-bold shadow-lg shadow-[#1f3a28]/20 transition"
            >
              Iniciar demo
            </button>
          )}
        </div>

        <div className="landing-hero-frame overflow-hidden rounded-[1.75rem] bg-[#0b1a10]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#132018] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1f3a28] text-xs font-bold text-[#e8efe9] ring-2 ring-[#5f8f63]/40">
                WC
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#e8efe9]">
                  WhatsClaude · Demo
                </p>
                <p className="text-[11px] text-[#9bb59f]">
                  {loading ? "escribiendo…" : "en línea"}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${stageMeta.className}`}
            >
              {stageMeta.label}
            </span>
          </div>

          <div
            ref={scrollRef}
            className="demo-chat-bg flex h-[min(52vh,420px)] flex-col gap-2.5 overflow-y-auto px-3 py-4 sm:px-4"
          >
            {!started && (
              <div className="m-auto max-w-[260px] text-center">
                <p className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#e8efe9]">
                  Demo con IA real
                </p>
                <p className="mt-2 text-sm text-[#9bb59f]">
                  La IA responde en vivo. Tocá empezar y escribí como un cliente.
                </p>
                <button
                  type="button"
                  onClick={startDemo}
                  className="mt-5 inline-flex rounded-full border border-white bg-white px-5 py-2.5 text-sm font-bold text-[#132018] transition hover:bg-[#e8efe9]"
                >
                  Empezar
                </button>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`demo-msg flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "rounded-br-md bg-[#1f3a28] text-[#e8efe9]"
                        : "rounded-bl-md bg-[#e8efe9] text-[#132018]"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-[#e8efe9] px-3.5 py-3 shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}

            {error && (
              <div className="mx-auto max-w-[90%] rounded-lg border border-red-300/40 bg-red-950/40 px-3 py-2 text-center text-xs text-red-200">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-[#132018] px-3 py-3 sm:px-4">
            {closed && (
              <Link
                href="/app"
                className="mb-2 inline-flex w-full items-center justify-center rounded-full border border-white bg-white px-4 py-3 text-sm font-bold text-[#132018] transition hover:bg-[#e8efe9]"
              >
                Activar mi WhatsApp
              </Link>
            )}

            {started && !closed && (
              <div className="mb-2 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => send(s)}
                    className="rounded-full border border-[#c5d6c8] bg-[#f3f7f3] px-3 py-1.5 text-xs font-bold text-[#132018] transition hover:bg-white disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {started ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  placeholder="Escribí un mensaje…"
                  className="min-w-0 flex-1 rounded-full border border-white/15 bg-[#0b1a10] px-4 py-3 text-sm text-white placeholder:text-[#5f7a66] focus:border-[#5f8f63] focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="inline-flex shrink-0 items-center justify-center rounded-full border border-white bg-white px-4 py-3 text-sm font-bold text-[#132018] transition hover:bg-[#e8efe9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
            ) : (
              <p className="py-2 text-center text-xs text-[#7a9b7e]">
                Iniciá el demo para chatear con la IA
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
