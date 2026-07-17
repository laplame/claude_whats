// env-loader DEBE ser el primer import: los imports de ES modules se
// hoistean al tope del archivo, así que si va después de otros imports
// que leen process.env en su top-level, esos leen undefined.
import "./env-loader";

import fs from "node:fs";
import { fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import {
  getConnectionState,
  getConversationById,
  getPendingOutbox,
  markOutboxSent,
  listDashboardUserIds,
  getPendingConnectionCommands,
  markConnectionCommandProcessed,
  reconcileDuplicateConversations,
  reactivateExpiredHumanModes,
} from "../src/lib/db";
import { authDirFor, getHandle, getKnownOwnerIds, shutdown, start } from "../src/lib/baileys/client";
import { botLog } from "../src/lib/bot-log";
import { restoreSqliteFromMongo } from "../src/lib/mongo";
import {
  migrateLegacyAuthDir,
  migrateLegacyContextDir,
  migrateLegacyExclusions,
} from "../src/lib/legacy-migration";

let cachedVersion: [number, number, number] | undefined;
let lastKnownUserId = 0;

async function resolveVersion(): Promise<[number, number, number] | undefined> {
  if (cachedVersion) return cachedVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    cachedVersion = version;
    botLog.info(`usando versión Baileys/WA Web ${version.join(".")}`);
  } catch (err) {
    botLog.warn("no se pudo obtener la última versión de Baileys/WA Web:", err);
  }
  return cachedVersion;
}

async function processOutbox(): Promise<void> {
  for (const ownerId of getKnownOwnerIds()) {
    const state = getConnectionState(ownerId);
    if (state.status !== "connected") continue;

    const handle = getHandle(ownerId);
    if (!handle) continue;

    const pending = getPendingOutbox(ownerId, 20);
    for (const item of pending) {
      try {
        const conversation = getConversationById(item.conversation_id, ownerId);
        const jid = conversation?.remote_jid || `${item.phone}@s.whatsapp.net`;
        await handle.sock.sendMessage(jid, { text: item.content });
        markOutboxSent(item.id);
        botLog.info(`→ (human) [owner ${ownerId}] enviado a ${item.phone}`);
      } catch (err) {
        botLog.error(`error enviando outbox #${item.id} (owner ${ownerId}) a ${item.phone}:`, err);
        // se deja sent=0, se reintenta en el próximo tick
      }
    }
  }
}

/** Reemplaza el viejo flag global `data/.restart` por una cola por-tenant en SQLite. */
async function checkConnectionCommands(): Promise<void> {
  const pending = getPendingConnectionCommands();
  for (const cmd of pending) {
    if (cmd.command === "disconnect") {
      botLog.info(`[owner ${cmd.owner_id}] comando de desconexión recibido, cerrando sesión...`);
      await shutdown(cmd.owner_id);
      fs.rmSync(authDirFor(cmd.owner_id), { recursive: true, force: true });
      botLog.info(`[owner ${cmd.owner_id}] arrancando de nuevo, se va a generar un QR nuevo...`);
      await start(cmd.owner_id, await resolveVersion());
    }
    markConnectionCommandProcessed(cmd.id);
  }
}

/** Detecta cuentas nuevas creadas mientras el bot ya estaba corriendo. */
async function checkNewSignups(): Promise<void> {
  const ids = listDashboardUserIds();
  const fresh = ids.filter((id) => id > lastKnownUserId);
  if (fresh.length === 0) return;

  const version = await resolveVersion();
  for (const ownerId of fresh) {
    botLog.info(`[owner ${ownerId}] cuenta nueva detectada, iniciando sesión de WhatsApp...`);
    start(ownerId, version).catch((err) =>
      botLog.error(`[owner ${ownerId}] error iniciando sesión:`, err)
    );
  }
  lastKnownUserId = Math.max(lastKnownUserId, ...ids);
}

async function main() {
  botLog.info("iniciando agente de WhatsApp (multi-tenant)...");

  const ownerIds = listDashboardUserIds();
  lastKnownUserId = ownerIds.length > 0 ? Math.max(...ownerIds) : 0;

  // Sesión/contexto de antes del refactor multi-tenant vivían sueltos en la
  // raíz (auth/, data/context/). Se migran una sola vez a la carpeta del
  // primer usuario (el admin sembrado) antes de arrancar cualquier socket.
  if (ownerIds.length > 0) {
    const legacyOwnerId = ownerIds[0];
    migrateLegacyAuthDir(legacyOwnerId);
    migrateLegacyContextDir(legacyOwnerId);
    migrateLegacyExclusions(legacyOwnerId);
  }

  restoreSqliteFromMongo()
    .then((result) => {
      if (result.conversations > 0 || result.messages > 0) {
        botLog.info(
          `restauradas ${result.conversations} conversaciones y ${result.messages} mensajes desde MongoDB`
        );
      }
      for (const ownerId of listDashboardUserIds()) {
        try {
          const merged = reconcileDuplicateConversations(ownerId);
          if (merged > 0) {
            botLog.info(`[owner ${ownerId}] fusionadas ${merged} conversaciones duplicadas`);
          }
        } catch (err) {
          botLog.error(`[owner ${ownerId}] error en reconcileDuplicateConversations:`, err);
        }
      }
    })
    .catch((err) => botLog.warn("restauración desde MongoDB omitida:", err));

  reactivateExpiredHumanModes();

  const version = await resolveVersion();
  for (const [index, ownerId] of ownerIds.entries()) {
    if (index > 0) {
      // Escalonado para no saturar el handshake de WebSocket si hay muchas
      // cuentas arrancando al mismo tiempo.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    start(ownerId, version).catch((err) =>
      botLog.error(`[owner ${ownerId}] error iniciando sesión:`, err)
    );
  }

  setInterval(() => {
    processOutbox().catch((err) => botLog.error("error en processOutbox:", err));
  }, 2000);

  setInterval(() => {
    checkConnectionCommands().catch((err) => botLog.error("error en checkConnectionCommands:", err));
  }, 1000);

  setInterval(() => {
    checkNewSignups().catch((err) => botLog.error("error en checkNewSignups:", err));
  }, 3000);

  setInterval(() => {
    try {
      reactivateExpiredHumanModes();
    } catch (err) {
      botLog.error("error en reactivateExpiredHumanModes:", err);
    }
  }, 2000);
}

main().catch((err) => {
  botLog.error("error fatal:", err);
  process.exit(1);
});
