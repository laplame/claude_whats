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
  hasRecentAssistantMessage,
  hasRecentHumanMessage,
  insertMessage,
  setMode,
  setTags,
  upsertLidMapping,
} from "../db";
import { generateReply } from "../llm";
import { botLog } from "../bot-log";
import { normalizePhone } from "../phone";
import { getActiveContextFilenames, hasDefinedBotContext } from "../bot-context";
import { escalateStageForBuyingIntent, hasBuyingIntent } from "../crm-stages";

/** Respuesta amigable cuando aún no hay MD de contexto para el owner. */
export const NO_CONTEXT_REPLY = [
  "Hola, gracias por escribirnos.",
  "Todavía no tengo cargado el contexto del negocio (precios, políticas y guiones), así que no puedo darte una respuesta precisa todavía.",
  "En cuanto un administrador suba esos archivos en el dashboard (sección Contexto), te atiendo con esa información. Si es urgente, pedí hablar con un asesor humano.",
].join(" ");

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

  // En mensajes fromMe, senderPn es nuestro número — el hilo es remoteJid (el contacto).
  let rawPhone: string;
  if (msg.key.fromMe) {
    rawPhone = extractPhoneFromJid(remoteJid);
  } else {
    const pn = msg.key.senderPn || msg.key.participantPn;
    rawPhone = pn ? extractPhoneFromJid(pn) : extractPhoneFromJid(remoteJid);
  }
  const phone = normalizePhone(rawPhone);

  // pushName en fromMe suele ser el nombre del negocio, no del contacto.
  const name = msg.key.fromMe ? null : (msg.pushName ?? null);

  return {
    phone,
    remoteJid,
    name,
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
  autoReply: boolean,
  ownerId: number
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

  if (isLidUser(contact.remoteJid) && !msg.key.fromMe) {
    const pn = msg.key.senderPn || msg.key.participantPn;
    if (pn && isJidUser(jidNormalizedUser(pn))) {
      upsertLidMapping(ownerId, contact.remoteJid, jidNormalizedUser(pn));
    }
  }

  const createdAt = messageTimestamp(msg);

  if (msg.key.fromMe) {
    const convo = getOrCreateConversation(ownerId, contact.phone, contact.name, contact.remoteJid);
    const isEcho =
      hasRecentHumanMessage(convo.id, text, 5) || hasRecentAssistantMessage(convo.id, text, 5);
    if (!isEcho) {
      insertMessage(convo.id, "human", text, createdAt);
      setMode(convo.id, "HUMAN");
      botLog.debug(`registrado outgoing human message para ${contact.phone}`);
    }
    return;
  }

  botLog.info(`← [owner ${ownerId}] Mensaje de ${contact.phone}: "${text}"`);

  const convo = getOrCreateConversation(ownerId, contact.phone, contact.name, contact.remoteJid);
  insertMessage(convo.id, "user", text, createdAt);

  if (!autoReply) return;

  // Auto-escala LEAD/MKTQL a SALES cuando el mensaje muestra intención
  // fuerte de compra. Nunca baja de etapa ni reabre CLOSED/SALES-AGAIN, y no
  // corre durante el import de historial (solo mensajes en vivo).
  if (hasBuyingIntent(text)) {
    const nextTags = escalateStageForBuyingIntent(convo.tags);
    if (nextTags) {
      setTags(convo.id, nextTags);
      botLog.info(`CRM auto-escalado a SALES para ${contact.phone} (intención de compra detectada)`);
    }
  }

  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    if (fresh?.mode === "HUMAN") {
      botLog.info(
        `modo HUMAN activo para ${contact.phone}, no se auto-responde (esperando timeout o volver a AI)`
      );
    }
    return;
  }

  try {
    if (!hasDefinedBotContext(ownerId, convo.id)) {
      // Evita spamear el mismo aviso si el lead escribe varias veces seguidas.
      if (hasRecentAssistantMessage(convo.id, NO_CONTEXT_REPLY, 120)) {
        botLog.warn(
          `sin contexto para ${contact.phone}; aviso reciente ya enviado, no se repite`
        );
        return;
      }
      botLog.warn(
        `sin contexto definido para ${contact.phone} (owner ${ownerId}), enviando aviso amigable`
      );
      insertMessage(convo.id, "assistant", NO_CONTEXT_REPLY);
      await sock.sendMessage(contact.remoteJid, { text: NO_CONTEXT_REPLY });
      return;
    }

    const contextFiles = getActiveContextFilenames(ownerId, convo.id);
    const history = getRecentHistory(convo.id, 20);
    botLog.debug(
      `llamando LLM con ${history.length} mensajes y contexto: ${contextFiles.join(", ")}`
    );
    const start = Date.now();
    const reply = await generateReply(history, ownerId, convo.id);
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
  payload: UpsertPayload,
  ownerId: number
): Promise<void> {
  botLog.debug(`messages.upsert tipo="${payload.type}", count=${payload.messages.length}`);
  if (!payload.messages?.length) return;

  const autoReply = payload.type === "notify";

  for (const msg of payload.messages) {
    await storeMessage(sock, msg, autoReply, ownerId);
  }
}

export async function handleHistorySync(
  sock: WASocket,
  messages: WAMessage[],
  ownerId: number
): Promise<void> {
  if (!messages.length) return;

  botLog.info(`importando historial: ${messages.length} mensajes`);

  const sorted = [...messages].sort(
    (a, b) => Number(a.messageTimestamp ?? 0) - Number(b.messageTimestamp ?? 0)
  );

  for (const msg of sorted) {
    await storeMessage(sock, msg, false, ownerId);
  }

  botLog.info(`historial procesado (${messages.length} mensajes revisados)`);
}
