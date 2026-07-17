/** Soft limits for context MD files (product guidance + API guards). */

/** Recommended max number of separate .md files in the pool. */
export const CONTEXT_MAX_FILES = 20;

/** Hard cap enforced by concat/upload APIs. */
export const CONTEXT_HARD_MAX_FILES = 40;

/** Recommended total characters across all active context (~safe for LLM window). */
export const CONTEXT_MAX_CHARS = 100_000;

/** Hard cap for a single concatenated output file. */
export const CONTEXT_HARD_MAX_CHARS = 250_000;

export function contextLimitsCopy() {
  return {
    maxFiles: CONTEXT_MAX_FILES,
    hardMaxFiles: CONTEXT_HARD_MAX_FILES,
    maxChars: CONTEXT_MAX_CHARS,
    autoConcat:
      "Sí: al responder, WhatsClaude concatena automáticamente todos los MD activos (globales o adjuntos a la conversación) en un solo system prompt, separados por === nombre.md ===.",
    manualConcat:
      "También podés ordenar y fusionar varios MD en un solo archivo desde /app → Flujo (arrastrá los bloques y guardá).",
    images:
      "Hoy el contexto del bot es solo texto Markdown. No hay flujos con imágenes ni nodos visuales de imagen para el LLM. La vista Flujo usa iconos arrastrables para ordenar archivos .md, no para enviar fotos al modelo.",
  };
}
