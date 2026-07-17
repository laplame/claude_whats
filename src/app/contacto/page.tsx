import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Contacto — WhatsClaude",
  description:
    "Contactá a un asesor o closer de WhatsClaude para activar tu cuenta, resolver dudas o ver una demo.",
};

export default function ContactoPage() {
  return (
    <SiteShell current="/contacto">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
          Contacto
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
          Hablá con un closer
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#3d5344]">
          Si ya viste el demo y querés activar WhatsClaude en tu número, o si
          necesitás una respuesta que no está en el FAQ, un asesor te acompaña.
        </p>

        <div className="mt-10 space-y-6">
          <div className="rounded-2xl border border-[#1f3a28]/12 bg-white/70 p-6">
            <h2 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#132018]">
              Demo en vivo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3d5344]">
              El chat del sitio usa IA con el FAQ como contexto. Pedí
              “pasame con un closer” y el flujo te lleva al cierre.
            </p>
            <Link
              href="/#demo"
              className="landing-btn-dark mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-bold transition"
            >
              Ir al demo
            </Link>
          </div>

          <div className="rounded-2xl border border-[#1f3a28]/12 bg-white/70 p-6">
            <h2 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#132018]">
              Activar cuenta
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3d5344]">
              Creá tu usuario, vinculá el QR y subí el contexto MD. En minutos
              tenés atención automática con control humano.
            </p>
            <Link
              href="/app"
              className="mt-4 inline-flex rounded-full border border-[#1f3a28] bg-[#f8fbf8] px-5 py-2.5 text-sm font-bold text-[#132018] transition hover:bg-white"
            >
              Abrir dashboard
            </Link>
          </div>

          <div className="rounded-2xl border border-[#1f3a28]/12 bg-white/70 p-6">
            <h2 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#132018]">
              Email
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3d5344]">
              Escribinos a{" "}
              <a
                href="mailto:hola@whatsclaude.app"
                className="font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4"
              >
                hola@whatsclaude.app
              </a>{" "}
              con tu número de negocio y qué querés automatizar. Respondemos con
              el siguiente paso de alta.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
