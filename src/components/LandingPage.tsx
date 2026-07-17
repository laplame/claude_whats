"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import WorkingDemo from "@/components/WorkingDemo";
import { BIZNEAI } from "@/lib/site-content";

const STEPS = [
  {
    num: "01",
    title: "Conectá tu WhatsApp",
    body: "Escaneá el QR una vez. El bot queda enlazado a tu número de negocio y empieza a recibir mensajes.",
  },
  {
    num: "02",
    title: "Definí el contexto",
    body: "Subí tus documentos MD con precios, políticas y guiones. Podés generarlos con tu IA favorita.",
    href: "/contexto",
    linkLabel: "Ver tutorial de contexto",
  },
  {
    num: "03",
    title: "Atendé y cerrá",
    body: "La IA responde solo con esa información, califica leads y actualiza el CRM. Cuando hace falta, pasás a modo humano.",
  },
];

const STATS = [
  { value: "24/7", label: "Atención automática" },
  { value: "5", label: "Estados de CRM" },
  { value: "1", label: "Tablero unificado" },
];

export default function LandingPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="landing min-h-[100dvh] overflow-x-hidden bg-[#e8efe9] text-[#132018]">
      <div
        className={`landing-bg pointer-events-none fixed inset-0 -z-10 transition-opacity duration-1000 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-10 lg:px-16">
        <p className="font-[family-name:var(--font-landing-display)] text-xl font-bold tracking-tight sm:text-2xl">
          WhatsClaude
        </p>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#3d5344] md:flex">
          <Link href="/como-funciona" className="transition hover:text-[#132018]">
            Cómo funciona
          </Link>
          <a href="#demo" className="transition hover:text-[#132018]">
            Demo
          </a>
          <Link href="/contexto" className="transition hover:text-[#132018]">
            Contexto
          </Link>
          <Link href="/precios" className="transition hover:text-[#132018]">
            Precios
          </Link>
          <Link href="/faq" className="transition hover:text-[#132018]">
            FAQ
          </Link>
          <Link href="/contacto" className="transition hover:text-[#132018]">
            Contacto
          </Link>
        </nav>
        <Link
          href="/app"
          className="rounded-full border border-[#1f3a28] bg-[#f8fbf8] px-5 py-2 text-sm font-bold text-[#132018] shadow-sm transition hover:bg-white hover:shadow-md"
        >
          Entrar
        </Link>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-16 pt-8 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:px-16 lg:pb-24 lg:pt-12">
        <div
          className={`relative z-10 flex flex-col transition-all duration-700 ${
            ready ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#1f3a28]/15 bg-white/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#1f3a28] backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#5f8f63]" />
            WhatsApp · IA · CRM · BizneAI
          </span>
          <h1 className="mt-6 max-w-xl font-[family-name:var(--font-landing-display)] text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-tight text-[#132018]">
            Tu WhatsApp de ventas, con IA que sigue{" "}
            <span className="text-[#3d6b47]">tus reglas.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#3d5344] sm:text-lg">
            Conectá el número, cargá el contexto del negocio y dejá que el bot
            atienda, califique y organice pedidos en un solo tablero. Preparado
            para usarse con{" "}
            <a
              href={BIZNEAI.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4"
            >
              BizneAI
            </a>{" "}
            y los datos de tu tienda.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="landing-btn-dark inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-bold shadow-lg shadow-[#1f3a28]/20 transition hover:shadow-xl"
            >
              Abrir dashboard
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-full border border-[#1f3a28] bg-[#f8fbf8] px-7 py-3.5 text-sm font-bold text-[#132018] shadow-sm transition hover:bg-white hover:shadow-md"
            >
              Probar demo
            </a>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-[#1f3a28]/10 pt-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="font-[family-name:var(--font-landing-display)] text-2xl font-bold text-[#1f3a28] sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-xs leading-snug text-[#5f7a66]">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className={`relative transition-all duration-1000 delay-150 ${
            ready ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="landing-hero-frame relative overflow-hidden rounded-[2rem]">
            <Image
              src="/landing-hero.png"
              alt="WhatsClaude atendiendo una conversación de WhatsApp con IA"
              width={1024}
              height={768}
              priority
              className="h-auto w-full object-cover"
            />
          </div>

          <div className="landing-float absolute -bottom-5 -left-3 z-10 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/85 px-4 py-3 shadow-xl backdrop-blur sm:-left-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f3a28] text-sm font-bold text-[#e8efe9]">
              IA
            </span>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-[#132018]">
                Lead calificado → MKTQL
              </p>
              <p className="text-[11px] text-[#5f7a66]">CRM actualizado</p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="como-funciona"
        className="relative border-t border-[#1f3a28]/15 bg-[#f3f7f3]/70 px-5 py-20 backdrop-blur sm:px-10 lg:px-16"
      >
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
            Cómo funciona
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
            Tres pasos. Sin stack raro.
          </h2>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.num}
                className="group relative rounded-2xl border border-[#1f3a28]/10 bg-white/70 p-6 transition hover:-translate-y-1 hover:border-[#1f3a28]/25 hover:shadow-lg"
              >
                <span className="font-[family-name:var(--font-landing-display)] text-4xl font-bold text-[#7a9b7e] transition group-hover:text-[#3d6b47]">
                  {step.num}
                </span>
                <h3 className="mt-4 font-[family-name:var(--font-landing-display)] text-xl font-semibold text-[#132018]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3d5344]">
                  {step.body}
                </p>
                {"href" in step && step.href ? (
                  <>
                    <Link
                      href={step.href}
                      className="mt-3 inline-block text-sm font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4"
                    >
                      {step.linkLabel}
                    </Link>
                    <p className="mt-2 text-xs text-[#5f7a66]">
                      Sin contexto, el bot no inventa: no responde en automático.
                    </p>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="tablero"
        className="relative px-5 py-20 sm:px-10 lg:px-16"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="landing-hero-frame order-2 overflow-hidden rounded-[2rem] lg:order-1">
            <Image
              src="/landing-crm.png"
              alt="Tablero CRM de WhatsClaude con pedidos organizados por estado"
              width={1024}
              height={576}
              className="h-auto w-full object-cover"
            />
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
              En el tablero
            </p>
            <h2 className="mt-3 max-w-xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
              Chat, contexto y CRM en la misma sesión.
            </h2>
            <div className="mt-10 space-y-8">
              <div className="border-l-2 border-[#7a9b7e]/50 pl-5">
                <h3 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#132018]">
                  Conversaciones unificadas
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#3d5344]">
                  Un hilo por número. Mensajes de WhatsApp, respuestas de la IA
                  y notas del equipo quedan juntos, sin perder contexto.
                </p>
              </div>
              <div className="border-l-2 border-[#7a9b7e]/50 pl-5">
                <h3 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#132018]">
                  Modo IA / humano
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#3d5344]">
                  La IA atiende sola. Cuando escribís vos, se pausa. Si hay
                  inactividad, vuelve al modo automático.
                </p>
              </div>
              <div className="border-l-2 border-[#7a9b7e]/50 pl-5">
                <h3 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-[#132018]">
                  Pedidos por estado
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#3d5344]">
                  LEAD, MKTQL, SALES, CLOSED y SALES-AGAIN. Arrastrá tarjetas,
                  agregá notas y abrí el chat desde el CRM.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="bizneai"
        className="relative border-t border-[#1f3a28]/15 px-5 py-16 sm:px-10 lg:px-16"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
              Integración
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
              Listo para {BIZNEAI.name}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#3d5344]">
              Este agente está preparado para usarse con{" "}
              <a
                href={BIZNEAI.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4"
              >
                BizneAI
              </a>
              , el punto de venta con IA. Usa los datos de tu tienda —catálogo,
              precios e inventario— para que WhatsApp responda con información
              real del negocio, no con respuestas genéricas.
            </p>
          </div>
          <a
            href={BIZNEAI.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-[#1f3a28] bg-[#f8fbf8] px-7 py-3.5 text-sm font-bold text-[#132018] shadow-sm transition hover:bg-white hover:shadow-md"
          >
            Conocer BizneAI →
          </a>
        </div>
      </section>

      <WorkingDemo />

      <section className="relative px-5 pb-20 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-[2.5rem] border border-[#1f3a28]/20 bg-[#1f3a28] px-6 py-16 text-[#e8efe9] sm:px-12 lg:px-16">
          <h2 className="max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight sm:text-5xl">
            Empezá con tu número y tu contexto.
          </h2>
          <p className="mt-4 max-w-lg text-base text-[#b7c9ba]">
            Creá tu cuenta, vinculá WhatsApp y subí los MD del negocio. En
            minutos tenés atención automática con control humano.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-full border border-white bg-white px-7 py-3.5 text-sm font-bold text-[#132018] transition hover:bg-[#e8efe9]"
            >
              Ir al dashboard
            </Link>
            <a
              href="#demo"
              className="landing-btn-dark-soft inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-bold transition"
            >
              Volver al demo
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
