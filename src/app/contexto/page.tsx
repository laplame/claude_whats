import type { Metadata } from "next";
import ContextoTutorial from "@/components/ContextoTutorial";

export const metadata: Metadata = {
  title: "Crear contexto — WhatsClaude",
  description:
    "Tutorial: cómo generar el contexto MD con IA, subirlo a WhatsClaude y hacer que el bot responda solo con precios, políticas y guiones.",
};

export default function ContextoPage() {
  return <ContextoTutorial />;
}
