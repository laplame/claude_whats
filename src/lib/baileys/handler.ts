import type { WASocket, WAMessage, MessageUpsertType } from "@whiskeysockets/baileys";
import {
  extractMessageContent,
  getContentType,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  isJidUser,
  isLidUser,
  jidNormalizedUser,
  normalizeMessageContent,
} from "@whiskeysockets/baileys";
import {
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  hasRecentHumanMessage,
  insertMessage,
} from "../db";
import { generateReply } from "../llm";
import { botLog } from "../bot-log";

interface UpsertPayload {
  messages: WAMessage[];
  type: MessageUpsertType;
}

interface ResolvedContact {
  phone: string;
  remoteJid: string;
  name: string | null;
}

function extractPhoneFromJid(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

function resolveContact(msg: WAMessage): ResolvedContact | null {
  const rawJid = msg.key.remoteJid;
  if (!rawJid) return null;

  const remoteJid = jidNormalizedUser(rawJid);
  const pn = msg.key.senderPn || msg.key.participantPn;
  const phone = pn ? extractPhoneFromJid(pn) : extractPhoneFromJid(remoteJid);

  return {
    phone,
    remoteJid,
    name: msg.pushName ?? null,
  };
}

function isDirectChatJid(jid: string): boolean {
  return Boolean(isJidUser(jid) || isLidUser(jid));
}

function shouldStoreMessage(msg: WAMessage): boolean {
  if (msg.messageStubType) return false;

  const content = normalizeMessageContent(msg.message);
  if (!content) return false;
  if (content.protocolMessage) return false;
  if (content.reactionMessage) return false;
  if (content.pollUpdateMessage) return false;
  if (content.senderKeyDistributionMessage) return false;

  return Boolean(getContentType(content));
}

function extractText(msg: WAMessage): string | null {
  const content = extractMessageContent(msg.message);
  if (!content) return null;

  const type = getContentType(content);
  if (!type) return null;

  switch (type) {
    case "conversation":
      return content.conversation?.trim() || null;
    case "extendedTextMessage":
      return content.extendedTextMessage?.text?.trim() || null;
    case "imageMessage":
      return content.imageMessage?.caption?.trim() || "[imagen]";
    case "videoMessage":
      return content.videoMessage?.caption?.trim() || "[video]";
    case "documentMessage":
      return (
        content.documentMessage?.caption?.trim() ||
        content.documentMessage?.fileName?.trim() ||
        "[documento]"
      );
    case "audioMessage":
      return "[audio]";
    case "stickerMessage":
      return "[sticker]";
    case "locationMessage":
      return content.locationMessage?.name?.trim() || "[ubicación]";
    case "contactMessage":
      return `[contacto: ${content.contactMessage?.displayName || "sin nombre"}]`;
    case "buttonsResponseMessage":
      return (
        content.buttonsResponseMessage?.selectedDisplayText?.trim() ||
        content.buttonsResponseMessage?.selectedButtonId?.trim() ||
        null
      );
    case "listResponseMessage":
      return (
        content.listResponseMessage?.title?.trim() ||
        content.listResponseMessage?.singleSelectReply?.selectedRowId?.trim() ||
        null
      );
    default:
      return null;
  }
}

function messageTimestamp(msg: WAMessage): number | undefined {
  if (!msg.messageTimestamp) return undefined;
  const ts = Number(msg.messageTimestamp);
  return Number.isFinite(ts) ? Math.floor(ts) : undefined;
}

async function storeMessage(
  sock: WASocket,
  msg: WAMessage,
  autoReply: boolean
): Promise<void> {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  if (isJidGroup(remoteJid) || isJidBroadcast(remoteJid) || isJidNewsletter(remoteJid)) {
    botLog.debug(`ignorando chat no directo: ${remoteJid}`);
    return;
  }
  if (isJidStatusBroadcast(remoteJid)) return;
  if (!isDirectChatJid(jidNormalizedUser(remoteJid))) {
    botLog.debug(`ignorando remoteJid no soportado: ${remoteJid}`);
    return;
  }
  if (!shouldStoreMessage(msg)) {
    botLog.debug("ignorando: mensaje de sistema o sin contenido");
    return;
  }

  const text = extractText(msg);
  if (!text) {
    botLog.debug("ignorando: sin texto extraíble");
    return;
  }

  const contact = resolveContact(msg);
  if (!contact) return;

  const createdAt = messageTimestamp(msg);

  if (msg.key.fromMe) {
    const convo = getOrCreateConversation(contact.phone, contact.name, contact.remoteJid);
    if (!hasRecentHumanMessage(convo.id, text, 5)) {
      insertMessage(convo.id, "human", text, createdAt);
      botLog.debug(`registrado outgoing human message para ${contact.phone}`);
    }
    return;
  }

  botLog.info(`← Mensaje de ${contact.phone}: "${text}"`);

  const convo = getOrCreateConversation(contact.phone, contact.name, contact.remoteJid);
  insertMessage(convo.id, "user", text, createdAt);

  if (!autoReply) return;

  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") return;

  try {
    const history = getRecentHistory(convo.id, 20);
    botLog.debug(`llamando LLM con ${history.length} mensajes...`);
    const start = Date.now();
    const reply = await generateReply(history, convo.id);
    botLog.info(`LLM respondió en ${Date.now() - start}ms`);

    insertMessage(convo.id, "assistant", reply);
    await sock.sendMessage(contact.remoteJid, { text: reply });
    botLog.info(`→ Enviado a ${contact.phone}`);
  } catch (err) {
    botLog.error(`error generando/enviando respuesta a ${contact.phone}:`, err);
  }
}

export async function handleIncomingMessages(
  sock: WASocket,
  payload: UpsertPayload
): Promise<void> {
  botLog.debug(`messages.upsert tipo="${payload.type}", count=${payload.messages.length}`);
  if (!payload.messages?.length) return;

  const autoReply = payload.type === "notify";

  for (const msg of payload.messages) {
    await storeMessage(sock, msg, autoReply);
  }
}

export async function handleHistorySync(sock: WASocket, messages: WAMessage[]): Promise<void> {
  if (!messages.length) return;

  botLog.info(`importando historial: ${messages.length} mensajes`);

  const sorted = [...messages].sort(
    (a, b) => Number(a.messageTimestamp ?? 0) - Number(b.messageTimestamp ?? 0)
  );

  for (const msg of sorted) {
    await storeMessage(sock, msg, false);
  }

  botLog.info(`historial procesado (${messages.length} mensajes revisados)`);
}
