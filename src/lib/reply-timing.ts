import type { WASocket } from "@whiskeysockets/baileys";
import { clampReplyDelaySec } from "./db";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tiempo total de "escribiendo..." antes de enviar.
 * - base: delay configurado (1–4 s)
 * - extra: textos largos simulan tipeo (~45 ms/carácter después de 60 chars, tope +6 s)
 */
export function typingDurationMs(text: string, baseDelaySec: number): number {
  const baseMs = clampReplyDelaySec(baseDelaySec) * 1000;
  const len = text.trim().length;
  const extraMs = len > 60 ? Math.min((len - 60) * 45, 6000) : 0;
  return baseMs + extraMs;
}

async function showComposing(sock: WASocket, jid: string): Promise<void> {
  try {
    await sock.sendPresenceUpdate("composing", jid);
  } catch {
    // presence no es crítica
  }
}

export async function startTyping(sock: WASocket, jid: string): Promise<void> {
  await showComposing(sock, jid);
}

export async function stopTyping(sock: WASocket, jid: string): Promise<void> {
  await clearComposing(sock, jid);
}

async function clearComposing(sock: WASocket, jid: string): Promise<void> {
  try {
    await sock.sendPresenceUpdate("paused", jid);
  } catch {
    // ignore
  }
}

/**
 * Muestra "escribiendo..." durante `durationMs`, renovando el indicador
 * cada ~8s (WhatsApp lo apaga solo si no se refresca).
 */
export async function holdTyping(
  sock: WASocket,
  jid: string,
  durationMs: number
): Promise<void> {
  if (durationMs <= 0) return;

  await showComposing(sock, jid);
  const started = Date.now();
  while (Date.now() - started < durationMs) {
    const left = durationMs - (Date.now() - started);
    const slice = Math.min(8000, left);
    if (slice <= 0) break;
    await sleep(slice);
    if (Date.now() - started < durationMs) {
      await showComposing(sock, jid);
    }
  }
}

/**
 * Espera el delay natural (descontando tiempo ya gastado, p.ej. en el LLM)
 * con indicador de escritura, envía el texto y pausa composing.
 */
export async function sendWithNaturalTyping(
  sock: WASocket,
  jid: string,
  text: string,
  opts: { delaySec: number; alreadyElapsedMs?: number }
): Promise<void> {
  const targetMs = typingDurationMs(text, opts.delaySec);
  const remainingMs = Math.max(0, targetMs - (opts.alreadyElapsedMs ?? 0));

  await holdTyping(sock, jid, remainingMs);
  await sock.sendMessage(jid, { text });
  await clearComposing(sock, jid);
}
