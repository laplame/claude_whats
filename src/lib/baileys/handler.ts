import type { WASocket, WAMessage, MessageUpsertType } from "@whiskeysockets/baileys";
import {
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  insertMessage,
} from "../db";
import { generateReply } from "../llm";

interface UpsertPayload {
  messages: WAMessage[];
  type: MessageUpsertType;
}

function extractText(msg: WAMessage): string | null {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    null
  );
}

function extractPhone(remoteJid: string): string {
  return remoteJid.split("@")[0];
}

export async function handleIncomingMessages(
  sock: WASocket,
  payload: UpsertPayload
): Promise<void> {
  if (payload.type !== "notify") return;

  for (const msg of payload.messages) {
    await handleSingleMessage(sock, msg);
  }
}

async function handleSingleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;
  if (msg.key.fromMe) return;
  if (remoteJid.endsWith("@g.us")) return;
  if (!remoteJid.endsWith("@s.whatsapp.net")) return;

  const text = extractText(msg);
  if (!text) return;

  const phone = extractPhone(remoteJid);
  console.log(`[bot] ← Mensaje de ${phone}: "${text}"`);

  const convo = getOrCreateConversation(phone, msg.pushName ?? null);
  insertMessage(convo.id, "user", text);

  // Re-leer por si el modo cambió (toggle desde el dashboard) entre la
  // creación de la conversación y este chequeo.
  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") return;

  try {
    const history = getRecentHistory(convo.id, 20);
    console.log(`[bot] llamando LLM con ${history.length} mensajes...`);
    const start = Date.now();
    const reply = await generateReply(history);
    console.log(`[bot] LLM respondió en ${Date.now() - start}ms`);

    insertMessage(convo.id, "assistant", reply);
    await sock.sendMessage(remoteJid, { text: reply });
    console.log(`[bot] → Enviado a ${phone}`);
  } catch (err) {
    console.error(`[bot] error generando/enviando respuesta a ${phone}:`, err);
  }
}
