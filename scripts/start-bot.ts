// env-loader DEBE ser el primer import: los imports de ES modules se
// hoistean al tope del archivo, así que si va después de otros imports
// que leen process.env en su top-level, esos leen undefined.
import "./env-loader";

import fs from "node:fs";
import path from "node:path";
import { getConnectionState, getPendingOutbox, markOutboxSent } from "../src/lib/db";
import { AUTH_DIR, getHandle, shutdown, start } from "../src/lib/baileys/client";

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
      const jid = `${item.phone}@s.whatsapp.net`;
      await handle.sock.sendMessage(jid, { text: item.content });
      markOutboxSent(item.id);
      console.log(`[bot] → (human) enviado a ${item.phone}`);
    } catch (err) {
      console.error(`[bot] error enviando outbox #${item.id} a ${item.phone}:`, err);
      // se deja sent=0, se reintenta en el próximo tick
    }
  }
}

async function checkRestartFlag(): Promise<void> {
  if (!fs.existsSync(RESTART_FLAG)) return;

  console.log("[bot] flag de reinicio detectado, cerrando sesión...");
  fs.unlinkSync(RESTART_FLAG);

  await shutdown();
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });

  console.log("[bot] arrancando de nuevo, se va a generar un QR nuevo...");
  await start();
}

async function main() {
  console.log("[bot] iniciando agente de WhatsApp...");
  await start();

  setInterval(() => {
    processOutbox().catch((err) => console.error("[bot] error en processOutbox:", err));
  }, 2000);

  setInterval(() => {
    checkRestartFlag().catch((err) => console.error("[bot] error en checkRestartFlag:", err));
  }, 1000);
}

main().catch((err) => {
  console.error("[bot] error fatal:", err);
  process.exit(1);
});
