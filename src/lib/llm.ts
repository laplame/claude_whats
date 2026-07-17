import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt";
import type { Message } from "./db";
import { buildContextSystemPrompt } from "./bot-context";

// Claude (Anthropic) es el proveedor principal. Si falla por cualquier
// motivo (rate limit, key inválida, timeout, etc.) se reintenta una vez
// con Gemini como fallback antes de propagar el error.

function toAnthropicRole(role: Message["role"]): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

async function generateWithClaudeSystem(history: Message[], system: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no está configurada. Editá .env.local con tu key real."
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: history.map((m) => ({
      role: toAnthropicRole(m.role),
      content: m.content,
    })),
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const reply = textBlock?.text?.trim();
  if (!reply) {
    throw new Error("Claude no devolvió contenido en la respuesta.");
  }
  return reply;
}

function toGeminiRole(role: Message["role"]): "user" | "model" {
  return role === "user" ? "user" : "model";
}

async function generateWithGeminiSystem(history: Message[], systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY no está configurada. Editá .env.local con tu key real."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model,
    contents: history.map((m) => ({
      role: toGeminiRole(m.role),
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction },
  });

  const reply = response.text?.trim();
  if (!reply) {
    throw new Error("Gemini no devolvió contenido en la respuesta.");
  }
  return reply;
}

export type LlmProvider = "claude" | "gemini";

export interface LlmResult {
  reply: string;
  provider: LlmProvider;
}

/**
 * Genera una respuesta usando Claude como proveedor principal y Gemini como
 * fallback automático. Recibe el system prompt completo ya armado.
 */
export async function generateReplyWithSystem(
  history: Message[],
  system: string
): Promise<LlmResult> {
  try {
    return { reply: await generateWithClaudeSystem(history, system), provider: "claude" };
  } catch (err) {
    console.warn("[llm] Claude falló, reintentando con Gemini como fallback:", err);
    try {
      return { reply: await generateWithGeminiSystem(history, system), provider: "gemini" };
    } catch (fallbackErr) {
      console.error("[llm] Gemini también falló:", fallbackErr);
      throw fallbackErr;
    }
  }
}

export async function generateReply(
  history: Message[],
  ownerId: number,
  conversationId?: number
): Promise<string> {
  const extraSystem = buildContextSystemPrompt(ownerId, conversationId);
  if (!extraSystem) {
    throw new Error(
      "No hay archivos de contexto definidos. Agregá .md en el proyecto o en data/context."
    );
  }

  const system = `${SYSTEM_PROMPT}\n\n${extraSystem}`;
  const { reply } = await generateReplyWithSystem(history, system);
  return reply;
}
