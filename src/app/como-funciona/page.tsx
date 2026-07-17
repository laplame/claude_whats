import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Cómo funciona — WhatsClaude",
  description:
    "Estructura del sistema WhatsClaude: conexión WhatsApp, contexto MD, IA, modo humano y CRM para el closer.",
};

const STEPS = [
  {
    num: "01",
    title: "Conectá WhatsApp",
    body: "Escaneás el QR una vez. El bot queda enlazado a tu número de negocio y empieza a recibir mensajes.",
  },
  {
    num: "02",
    title: "Subí el contexto",
    body: "Documentos MD con precios, políticas y guiones. Podés generarlos con tu IA favorita y subirlos en el dashboard. Sin contexto, el bot no responde en automático.",
  },
  {
    num: "03",
    title: "La IA responde solo con eso",
    body: "Atiende 24/7 con la información cargada, califica leads y actualiza el CRM: LEAD → MKTQL → SALES.",
  },
  {
    num: "04",
    title: "Closer cierra",
    body: "Cuando el lead está listo, el closer toma el hilo con todo el historial, cierra la venta y marca CLOSED.",
  },
];

export default function ComoFuncionaPage() {
  return (
    <SiteShell current="/como-funciona">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
          Estructura del sistema
        </p>
        <h1 className="mt-3 max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
          De WhatsApp a cierre, en un solo tablero.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#3d5344]">
          WhatsClaude une chat, contexto y CRM. La IA prepara el lead; el closer
          cierra con control humano. El FAQ alimenta el demo para que veas el
          mismo discurso de ventas.
        </p>

        <ol className="mt-12 space-y-6">
          {STEPS.map((step) => (
            <li
              key={step.num}
              className="grid gap-3 rounded-2xl border border-[#1f3a28]/12 bg-white/70 p-6 sm:grid-cols-[5rem_1fr] sm:gap-8"
            >
              <span className="font-[family-name:var(--font-landing-display)] text-3xl font-bold text-[#7a9b7e]">
                {step.num}
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold text-[#132018]">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#3d5344]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/contexto"
            className="landing-btn-dark inline-flex rounded-full px-6 py-3 text-sm font-bold transition"
          >
            Tutorial de contexto
          </Link>
          <Link
            href="/#demo"
            className="inline-flex rounded-full border border-[#1f3a28] bg-[#f8fbf8] px-6 py-3 text-sm font-bold text-[#132018] transition hover:bg-white"
          >
            Probar demo
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
