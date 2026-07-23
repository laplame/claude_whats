import { NextRequest, NextResponse } from "next/server";
import {
  CONTEXT_AI_SYSTEM,
  buildContextAiUserMessage,
  stripMarkdownFences,
  type ContextAiMode,
} from "@/lib/context-ai";
import { CONTEXT_HARD_MAX_CHARS } from "@/lib/context-limits";
import { generateReplyWithSystem } from "@/lib/llm";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

export const runtime = "nodejs";

const MAX_INSTRUCTION = 8_000;
const MAX_CONTENT = CONTEXT_HARD_MAX_CHARS;

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const body = await req.json().catch(() => null);
  const modeRaw = typeof body?.mode === "string" ? body.mode : "improve";
  const mode: ContextAiMode = modeRaw === "generate" ? "generate" : "improve";
  const instruction = typeof body?.instruction === "string" ? body.instruction : "";
  const content = typeof body?.content === "string" ? body.content : "";

  if (instruction.length > MAX_INSTRUCTION) {
    return NextResponse.json(
      { error: `instrucción demasiado larga (máx ${MAX_INSTRUCTION} chars)` },
      { status: 400 }
    );
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json(
      { error: `contenido demasiado largo (máx ${MAX_CONTENT} chars)` },
      { status: 400 }
    );
  }
  if (mode === "improve" && !content.trim() && !instruction.trim()) {
    return NextResponse.json(
      { error: "necesitás contenido o una instrucción" },
      { status: 400 }
    );
  }
  if (mode === "generate" && !instruction.trim()) {
    return NextResponse.json(
      { error: "para generar, escribí los datos del negocio en la instrucción" },
      { status: 400 }
    );
  }

  try {
    const userMessage = buildContextAiUserMessage({ mode, instruction, content });
    const { reply, provider } = await generateReplyWithSystem(
      [{ role: "user", content: userMessage }],
      CONTEXT_AI_SYSTEM
    );
    const markdown = stripMarkdownFences(reply);
    if (!markdown) {
      return NextResponse.json({ error: "la IA no devolvió Markdown" }, { status: 502 });
    }
    return NextResponse.json({ markdown, provider, mode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "falló la generación con IA" },
      { status: 502 }
    );
  }
}
