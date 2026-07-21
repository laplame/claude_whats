"use client";

import Link from "next/link";
import { useState } from "react";
import SiteShell from "@/components/SiteShell";
import {
  BIZNEAI,
  CONTEXT_EXAMPLE_MD,
  CONTEXT_PROMPT_TEMPLATE,
} from "@/lib/site-content";
import {
  CONTEXT_HARD_MAX_FILES,
  CONTEXT_MAX_CHARS,
  CONTEXT_MAX_FILES,
} from "@/lib/context-limits";

const STEPS = [
  {
    num: "01",
    title: "Reuní los datos de tu negocio",
    body: "Precios, planes, horarios, políticas de envío/cambios, FAQs y cómo querés que saluden. Si usás BizneAI, partí del catálogo y políticas de tu tienda.",
  },
  {
    num: "02",
    title: "Pedile a una IA que arme el Markdown",
    body: "Usá tu asistente de IA favorito. Pegá el prompt del tutorial y tus datos. Pedí un único archivo .md, sin inventar lo que falte.",
  },
  {
    num: "03",
    title: "Revisá y guardá como .md",
    body: "Corregí precios y políticas. Guardá el archivo como precios.md, politicas.md o guion.md (solo .md; sin espacios raros).",
  },
  {
    num: "04",
    title: "Subilo (o concatená) en WhatsClaude",
    body: `Entrá a /app → Contexto y subí uno o varios .md (hasta ~${CONTEXT_MAX_FILES}). En Flujo podés arrastrar iconos, ordenar y guardar un MD único. Si no subís nada, se crea solo contexto-general-closer.md para que el bot igual pueda responder.`,
  },
  {
    num: "05",
    title: "Probá y dejá que califique",
    body: "Mandá un WhatsApp de prueba. La IA responde solo con ese MD, califica el lead y actualiza el CRM. El closer toma cuando hace falta.",
  },
];

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1f3a28]/15 bg-[#0b1a10]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#9bb59f]">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-[#c5d6c8] bg-[#f3f7f3] px-3 py-1 text-xs font-bold text-[#132018] transition hover:bg-white"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap px-4 py-4 text-xs leading-relaxed text-[#e8efe9] sm:text-sm">
        {text}
      </pre>
    </div>
  );
}

export default function ContextoTutorial() {
  return (
    <SiteShell current="/contexto">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7a66]">
          Tutorial · Contexto
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-semibold leading-tight text-[#132018] sm:text-4xl">
          Cómo crear el contexto con IA
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#3d5344]">
          Verificado en el producto:{" "}
          <strong className="font-semibold text-[#132018]">
            2) subís documentos con precios, políticas y guiones
          </strong>{" "}
          y{" "}
          <strong className="font-semibold text-[#132018]">
            3) la IA responde solo con esa información, califica leads y
            actualiza el CRM
          </strong>
          . Si no hay MD propios, se usa automáticamente <code className="text-xs">contexto-general-closer.md</code> para no dejar sin respuesta.
        </p>

        <div className="mt-8 rounded-2xl border border-[#1f3a28]/12 bg-white/70 p-5 text-sm leading-relaxed text-[#3d5344]">
          <p className="font-semibold text-[#132018]">Qué acepta WhatsClaude</p>
          <ul className="mt-3 space-y-2">
            <li>
              • Solo archivos{" "}
              <code className="rounded bg-[#e8efe9] px-1.5 py-0.5 text-[12px]">
                .md
              </code>{" "}
              (Markdown).
            </li>
            <li>
              • Hasta <strong className="text-[#132018]">{CONTEXT_MAX_FILES} archivos</strong>{" "}
              recomendados (tope duro {CONTEXT_HARD_MAX_FILES}).
            </li>
            <li>
              • <strong className="text-[#132018]">Sí se concatenan</strong>: al
              responder, todos los MD activos se unen en un solo prompt. También
              podés fusionarlos a mano en /app → Flujo (arrastrá y guardá).
            </li>
            <li>
              • Volumen recomendado ~{CONTEXT_MAX_CHARS.toLocaleString()} caracteres
              totales para no saturar el modelo.
            </li>
            <li>• Subida desde el dashboard (/app → Contexto).</li>
            <li>
              • Compatible con datos de tienda vía{" "}
              <a
                href={BIZNEAI.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4"
              >
                BizneAI
              </a>
              .
            </li>
          </ul>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 text-sm leading-relaxed text-[#3d5344]">
          <p className="font-semibold text-[#132018]">¿Flujos con imágenes y arrastre?</p>
          <p className="mt-2">
            <strong className="text-[#132018]">Arrastre de iconos: sí</strong> — en
            /app → Flujo ordenás bloques MD (precios, políticas, guion) y los
            concatenás.
          </p>
          <p className="mt-2">
            <strong className="text-[#132018]">Imágenes en el contexto del bot: no todavía</strong>.
            El LLM solo lee texto Markdown. Un builder de flujos con nodos de
            imagen no está soportado para las respuestas de WhatsApp.
          </p>
        </div>

        <ol className="mt-12 space-y-6">
          {STEPS.map((step) => (
            <li
              key={step.num}
              className="grid gap-2 rounded-2xl border border-[#1f3a28]/12 bg-white/70 p-5 sm:grid-cols-[4rem_1fr] sm:gap-6"
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

        <div className="mt-14 space-y-4">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold text-[#132018]">
            Prompt para tu IA
          </h2>
          <p className="text-sm leading-relaxed text-[#3d5344]">
            Copiá esto, completá los datos de tu negocio y pedí que te
            devuelva solo el Markdown listo para guardar como archivo .md.
          </p>
          <CopyBlock label="Prompt" text={CONTEXT_PROMPT_TEMPLATE} />
        </div>

        <div className="mt-14 space-y-4">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold text-[#132018]">
            Ejemplo de archivo .md
          </h2>
          <p className="text-sm leading-relaxed text-[#3d5344]">
            Estructura recomendada. Reemplazá con datos reales antes de
            subirlo.
          </p>
          <CopyBlock label="ejemplo-contexto.md" text={CONTEXT_EXAMPLE_MD} />
        </div>

        <div className="mt-14 rounded-2xl border border-[#1f3a28]/15 bg-[#1f3a28] px-6 py-8 text-[#e8efe9]">
          <h2 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold">
            Siguiente paso
          </h2>
          <p className="mt-2 text-sm text-[#b7c9ba]">
            Generá el MD, subilo en el dashboard y mandá un mensaje de prueba.
            Si ya tenés BizneAI, usá los datos de tu tienda como fuente.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex rounded-full border border-white bg-white px-5 py-2.5 text-sm font-bold text-[#132018] transition hover:bg-[#e8efe9]"
            >
              Ir a Flujo / Contexto
            </Link>
            <Link
              href="/como-funciona"
              className="landing-btn-dark-soft inline-flex rounded-full px-5 py-2.5 text-sm font-bold transition"
            >
              Ver cómo funciona
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
