// env-loader DEBE ser el primer import: los imports de ES modules se
// hoistean al tope del archivo, así que si va después de otros imports
// que leen process.env en su top-level, esos leen undefined.
import "./env-loader";

import fs from "node:fs";
import path from "node:path";
import { getConnectionState, getConversationById, getPendingOutbox, markOutboxSent } from "../src/lib/db";
import { AUTH_DIR, getHandle, shutdown, start } from "../src/lib/baileys/client";
import { botLog } from "../src/lib/bot-log";

const RESTART_FLAG = path.resolve(process.cwd(), "data", ".restart");

async function processOutbox(): Promise<void> {
  const state = getConnectionState();
  if (state.status !== "connected") {
    return;
  }

  const handle = getHandle();
  if (!handle) return;

  const pending = getPendingOutbox(20);
  for (const item of pending) {
    try {
      const conversation = getConversationById(item.conversation_id);
      const jid = conversation?.remote_jid || `${item.phone}@s.whatsapp.net`;
      await handle.sock.sendMessage(jid, { text: item.content });
      markOutboxSent(item.id);
      botLog.info(`→ (human) enviado a ${item.phone}`);
    } catch (err) {
      botLog.error(`error enviando outbox #${item.id} a ${item.phone}:`, err);
      // se deja sent=0, se reintenta en el próximo tick
    }
  }
}

async function checkRestartFlag(): Promise<void> {
  if (!fs.existsSync(RESTART_FLAG)) return;

  botLog.info("flag de reinicio detectado, cerrando sesión...");
  fs.unlinkSync(RESTART_FLAG);

  await shutdown();
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });

  botLog.info("arrancando de nuevo, se va a generar un QR nuevo...");
  await start();
}

async function main() {
  botLog.info("iniciando agente de WhatsApp...");
  await start();

  setInterval(() => {
    processOutbox().catch((err) => botLog.error("error en processOutbox:", err));
  }, 2000);

  setInterval(() => {
    checkRestartFlag().catch((err) => botLog.error("error en checkRestartFlag:", err));
  }, 1000);
}

main().catch((err) => {
  botLog.error("error fatal:", err);
  process.exit(1);
});
