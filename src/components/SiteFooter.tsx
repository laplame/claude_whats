import Link from "next/link";
import { BIZNEAI, SITE_LINKS } from "@/lib/site-content";

export default function SiteFooter() {
  return (
    <footer className="relative border-t border-[#1f3a28]/15 bg-[#f3f7f3]/90">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:px-10 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-16">
        <div>
          <p className="font-[family-name:var(--font-landing-display)] text-xl font-bold text-[#132018]">
            WhatsClaude
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#3d5344]">
            WhatsApp + contexto + CRM. La IA atiende con tus reglas; el closer
            cierra con el historial completo.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#3d5344]">
            Preparado para usarse con{" "}
            <a
              href={BIZNEAI.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1f3a28] underline decoration-[#7a9b7e] underline-offset-4 transition hover:text-[#132018]"
            >
              {BIZNEAI.name}
            </a>
            : el agente responde con los datos de tu tienda.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7a66]">
            Navegación
          </p>
          <ul className="mt-4 space-y-2.5">
            {SITE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-[#1f3a28] transition hover:text-[#132018]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f7a66]">
            Producto
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-[#3d5344]">
            <li>
              <Link href="/#demo" className="font-medium text-[#1f3a28] transition hover:text-[#132018]">
                Demo del closer
              </Link>
            </li>
            <li>
              <Link href="/contexto" className="font-medium text-[#1f3a28] transition hover:text-[#132018]">
                Tutorial de contexto
              </Link>
            </li>
            <li>
              <Link href="/#bizneai" className="font-medium text-[#1f3a28] transition hover:text-[#132018]">
                Integración BizneAI
              </Link>
            </li>
            <li>
              <Link href="/faq" className="font-medium text-[#1f3a28] transition hover:text-[#132018]">
                Preguntas frecuentes
              </Link>
            </li>
            <li>
              <a
                href={BIZNEAI.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1f3a28] transition hover:text-[#132018]"
              >
                BizneAI →
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#1f3a28]/10">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-[#5f7a66] sm:px-10 lg:px-16">
          <span>© {new Date().getFullYear()} WhatsClaude</span>
          <span>
            Compatible con{" "}
            <a
              href={BIZNEAI.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1f3a28] hover:underline"
            >
              BizneAI
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
