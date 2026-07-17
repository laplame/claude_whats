import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import { FAQ_ITEMS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "FAQ — WhatsClaude",
  description:
    "Preguntas frecuentes sobre WhatsClaude: contexto, CRM, modo humano, closer y activación. Base de conocimiento del demo de ventas.",
};

export default function FaqPage() {
  return (
    <SiteShell current="/faq">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
          FAQ
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
          Preguntas frecuentes
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#3d5344]">
          Estas respuestas son la base de conocimiento del demo de closer: la IA
          del chat las usa para explicar el producto sin inventar datos. También
          podés probarlas en vivo en el{" "}
          <Link href="/#demo" className="font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4">
            working demo
          </Link>
          .
        </p>

        <div className="mt-12 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.id}
              className="group rounded-2xl border border-[#1f3a28]/12 bg-white/70 px-5 py-4 open:bg-white"
            >
              <summary className="cursor-pointer list-none font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#132018] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  {item.question}
                  <span className="mt-1 shrink-0 text-[#7a9b7e] transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#3d5344]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[#1f3a28]/15 bg-[#1f3a28] px-6 py-8 text-[#e8efe9]">
          <h2 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold">
            ¿No encontraste tu respuesta?
          </h2>
          <p className="mt-2 text-sm text-[#b7c9ba]">
            Escribí en el demo o contactá a un asesor. El closer te acompaña en
            el alta.
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
