import { CONTEXT_PROMPT_TEMPLATE } from "./site-content";

export const CONTEXT_AI_SYSTEM = `Sos un redactor de contexto para un agente de WhatsApp de ventas (WhatsClaude).
Tu salida debe ser ÚNICAMENTE el archivo Markdown completo, sin explicaciones ni fences \`\`\`.

Estructura preferida:
# Nombre del negocio
## Qué vendemos
## Precios y planes
## Políticas (envíos, cambios, horarios, formas de pago)
## Guion de atención
## Preguntas frecuentes
## Cuándo derivar a un humano

Reglas:
- Español, claro y corto. Listas con viñetas.
- NO inventes precios, stock, plazos ni políticas. Si falta un dato, usá "[COMPLETAR]".
- Conservá datos reales del borrador o de la instrucción del usuario.
- No agregues saludos al usuario ni meta-comentarios; solo el MD.
`;

export type ContextAiMode = "improve" | "generate";

export function buildContextAiUserMessage(input: {
  mode: ContextAiMode;
  instruction: string;
  content: string;
}): string {
  const instruction = input.instruction.trim();
  const content = input.content.trim();

  if (input.mode === "generate") {
    return [
      "Generá un archivo Markdown de contexto de negocio.",
      "Usá esta guía de estructura:",
      CONTEXT_PROMPT_TEMPLATE,
      "",
      "Datos / instrucción del usuario:",
      instruction || "(sin datos extra; usá placeholders [COMPLETAR] donde falte info)",
    ].join("\n");
  }

  return [
    "Mejorá o reescribí el Markdown de contexto según la instrucción.",
    "Devolvé el MD completo actualizado (no un diff).",
    "",
    "Instrucción:",
    instruction || "Ordená secciones, aclará viñetas y marcá con [COMPLETAR] lo que falte. No inventes datos.",
    "",
    "Markdown actual:",
    content || "(vacío — generá un borrador con [COMPLETAR])",
  ].join("\n");
}

/** Quita fences ```md ... ``` si el modelo las agrega. */
export function stripMarkdownFences(text: string): string {
  let out = text.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:markdown|md)?\s*/i, "");
    out = out.replace(/\s*```$/i, "");
  }
  return out.trim();
}
