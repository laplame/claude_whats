import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import PricingPlans from "@/components/PricingPlans";

export const metadata: Metadata = {
  title: "Precios — WhatsClaude",
  description:
    "Planes de WhatsClaude en pesos (MXN) y dólares (USD): agente de WhatsApp con IA, contexto propio y CRM por estados.",
};

export default function PreciosPage() {
  return (
    <SiteShell current="/precios">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">Precios</p>
        <h1 className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
          Un plan para cada etapa del negocio.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#3d5344]">
          Elegí el plan según tu volumen de conversaciones. Todos incluyen tu propio número de
          WhatsApp, contexto en Markdown y el tablero CRM. Cambiá de moneda para ver precios en
          pesos mexicanos o dólares.
        </p>

        <div className="mt-10">
          <PricingPlans />
        </div>

        <div className="mt-14 rounded-2xl border border-[#1f3a28]/15 bg-[#1f3a28] px-6 py-8 text-[#e8efe9]">
          <h2 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold">
            ¿No sabés qué plan te conviene?
          </h2>
          <p className="mt-2 text-sm text-[#b7c9ba]">
            Probá el demo del closer o hablá con un asesor antes de activar tu cuenta.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/#demo"
              className="inline-flex rounded-full border border-white bg-white px-5 py-2.5 text-sm font-bold text-[#132018] transition hover:bg-[#e8efe9]"
            >
              Probar demo
            </Link>
            <Link
              href="/contacto"
              className="landing-btn-dark-soft inline-flex rounded-full px-5 py-2.5 text-sm font-bold transition"
            >
              Contacto
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
