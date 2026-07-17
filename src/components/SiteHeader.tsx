import Link from "next/link";
import { SITE_LINKS } from "@/lib/site-content";

type SiteHeaderProps = {
  current?: string;
};

export default function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-10 lg:px-16">
      <Link
        href="/"
        className="font-[family-name:var(--font-landing-display)] text-xl font-bold tracking-tight text-[#132018] sm:text-2xl"
      >
        WhatsClaude
      </Link>

      <nav className="hidden items-center gap-6 text-sm font-medium text-[#3d5344] md:flex">
        {SITE_LINKS.filter((l) => l.href !== "/app").map((link) => {
          const active = current === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`transition hover:text-[#132018] ${
                active ? "font-semibold text-[#132018]" : ""
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/app"
        className="rounded-full border border-[#1f3a28] bg-[#f8fbf8] px-5 py-2 text-sm font-bold text-[#132018] shadow-sm transition hover:bg-white hover:shadow-md"
      >
        Entrar
      </Link>
    </header>
  );
}
