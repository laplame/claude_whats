import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt";
import type { Message } from "./db";

// Claude (Anthropic) es el proveedor principal. Si falla por cualquier
// motivo (rate limit, key inválida, timeout, etc.) se reintenta una vez
// con Gemini como fallback antes de propagar el error.

function toAnthropicRole(role: Message["role"]): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

async function generateWithClaude(history: Message[]): Promise<string> {
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
    system: SYSTEM_PROMPT,
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

async function generateWithGemini(history: Message[]): Promise<string> {
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
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const reply = response.text?.trim();
  if (!reply) {
    throw new Error("Gemini no devolvió contenido en la respuesta.");
  }
  return reply;
}

export async function generateReply(history: Message[]): Promise<string> {
  try {
    return await generateWithClaude(history);
  } catch (err) {
    console.warn("[llm] Claude falló, reintentando con Gemini como fallback:", err);
    try {
      return await generateWithGemini(history);
    } catch (fallbackErr) {
      console.error("[llm] Gemini también falló:", fallbackErr);
      throw fallbackErr;
    }
  }
}
