import type { Metadata, Viewport } from "next";
import { Syne, Manrope } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-landing-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-landing-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WhatsClaude — Agente de WhatsApp con IA y CRM",
  description:
    "Conectá WhatsApp, cargá el contexto de tu negocio y atendé leads con IA, modo humano y un CRM por estados.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e8efe9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${syne.variable} ${manrope.variable}`}>
      <body className="font-[family-name:var(--font-landing-body)] antialiased">
        {children}
      </body>
    </html>
  );
}
