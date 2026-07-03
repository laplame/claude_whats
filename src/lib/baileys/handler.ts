import type { WASocket, WAMessage, MessageUpsertType } from "@whiskeysockets/baileys";
import {
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  hasRecentHumanMessage,
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
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    null
  );
}

function extractPhone(remoteJid: string): string {
  return remoteJid.split("@")[0];
}

function isValidIncomingRemoteJid(remoteJid: string): boolean {
  return (
    remoteJid.endsWith("@s.whatsapp.net") ||
    remoteJid.endsWith("@lid")
  );
}

export async function handleIncomingMessages(
  sock: WASocket,
  payload: UpsertPayload
): Promise<void> {
  console.log(`[bot] messages.upsert tipo="${payload.type}", count=${payload.messages.length}`);
  if (!payload.messages?.length) {
    console.log("[bot] messages.upsert sin mensajes");
    return;
  }

  for (const msg of payload.messages) {
    await handleSingleMessage(sock, msg);
  }
}

async function handleSingleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) {
    console.log("[bot] ignorando: sin remoteJid");
    return;
  }
  console.log(
    `[bot] handleSingleMessage remoteJid=${remoteJid} fromMe=${msg.key.fromMe} type=${msg.message ? Object.keys(msg.message).join(",") : "none"}`
  );
  if (msg.key.fromMe) {
    const text = extractText(msg);
    if (!text) {
      console.log("[bot] ignorando fromMe: sin texto", msg.message);
      return;
    }

    const phone = extractPhone(remoteJid);
    const convo = getOrCreateConversation(phone, msg.pushName ?? null);
    if (!hasRecentHumanMessage(convo.id, text, 5)) {
      insertMessage(convo.id, "human", text);
      console.log(`[bot] registrado outgoing human message para ${phone}: ${text}`);
    } else {
      console.log(`[bot] outgoing human message ya registrado para ${phone}: ${text}`);
    }
    return;
  }
  if (remoteJid.endsWith("@g.us")) {
    console.log(`[bot] ignorando: grupo ${remoteJid}`);
    return;
  }
  if (!isValidIncomingRemoteJid(remoteJid)) {
    console.log(
      `[bot] ignorando: remoteJid inválido "${remoteJid}" ` +
      `(hasText=${Boolean(extractText(msg))}, msgType=${msg.key?.fromMe ? "fromMe" : "incoming"})`
    );
    return;
  }

  const text = extractText(msg);
  if (!text) {
    console.log("[bot] ignorando: sin texto", msg.message);
    return;
  }

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
    const reply = await generateReply(history, convo.id);
    console.log(`[bot] LLM respondió en ${Date.now() - start}ms`);

    insertMessage(convo.id, "assistant", reply);
    await sock.sendMessage(remoteJid, { text: reply });
    console.log(`[bot] → Enviado a ${phone}`);
  } catch (err) {
    console.error(`[bot] error generando/enviando respuesta a ${phone}:`, err);
  }
}
