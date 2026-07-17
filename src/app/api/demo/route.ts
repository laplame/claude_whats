import { NextRequest, NextResponse } from "next/server";
import { generateReplyWithSystem } from "@/lib/llm";
import { buildFaqSystemBlock } from "@/lib/site-content";
import type { MessageRole } from "@/lib/db";

export const runtime = "nodejs";

function buildDemoSystem(): string {
  const faqBlock = buildFaqSystemBlock();

  return `
Sos el asistente de ventas / closer demo de "WhatsClaude", un SaaS que conecta
WhatsApp con IA y un CRM. Estás en el DEMO público del sitio web.
Tu objetivo: explicar el producto con el FAQ oficial, calificar interés y llevar
la charla hacia activar una cuenta o hablar con un closer humano.

=== FAQ OFICIAL (fuente de verdad — no inventes fuera de esto) ===
${faqBlock}

REGLAS:
- Respondé en español neutro, cálido y directo.
- Mensajes MUY breves: 2 a 4 líneas, como un chat de WhatsApp real.
- No uses markdown ni listas largas; escribí como en un chat.
- Usá el FAQ como base. Si preguntan algo no cubierto, decí:
  "Déjame derivarte con un asesor humano." y sugerí /contacto o activar en /app.
- Hacé UNA sola pregunta por mensaje para avanzar la conversación.
- Si detectás intención de compra ("quiero", "cómo empiezo", "cuánto", "activar"),
  invitá a activar en /app y ofrecé pasar con un closer.
- Precio: no inventes cifras. El demo es gratis; planes se confirman con un asesor.
- No uses emojis salvo un saludo inicial opcional.
`.trim();
}

interface DemoMessage {
  role: MessageRole;
  content: string;
}

const MAX_MESSAGES = 20;
const MAX_LEN = 2000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawMessages = body?.messages;

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "messages requerido" }, { status: 400 });
  }

  const history: DemoMessage[] = rawMessages
    .slice(-MAX_MESSAGES)
    .map((m: unknown) => {
      const msg = m as { role?: unknown; content?: unknown };
      const role: MessageRole = msg.role === "assistant" ? "assistant" : "user";
      const content = typeof msg.content === "string" ? msg.content.slice(0, MAX_LEN) : "";
      return { role, content };
    })
    .filter((m) => m.content.trim().length > 0);

  if (history.length === 0) {
    return NextResponse.json({ error: "mensaje vacío" }, { status: 400 });
  }

  try {
    const { reply, provider } = await generateReplyWithSystem(
      history,
      buildDemoSystem()
    );
    return NextResponse.json({ reply, provider });
  } catch (err) {
    console.error("[api/demo] error generando respuesta:", err);
    return NextResponse.json(
      {
        error:
          "No pude generar la respuesta ahora mismo. Configurá ANTHROPIC_API_KEY o GEMINI_API_KEY en .env.local.",
      },
      { status: 502 }
    );
  }
}
