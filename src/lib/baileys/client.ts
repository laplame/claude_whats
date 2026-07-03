import path from "node:path";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { getConnectionState, setConnectionState } from "../db";
import { handleIncomingMessages } from "./handler";

const AUTH_DIR = path.resolve(process.cwd(), "auth");

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" });

export interface BaileysHandle {
  sock: WASocket;
}

let handle: BaileysHandle | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let starting = false;
let shuttingDown = false;

function extractPhone(jidOrId: string | undefined | null): string | null {
  if (!jidOrId) return null;
  const withoutSuffix = jidOrId.split(":")[0];
  return withoutSuffix.split("@")[0] || null;
}

function scheduleReconnect(code: number | undefined) {
  if (reconnectTimer) return;
  const delay = code === 440 ? 15000 : 5000;
  console.warn(`[bot] reconectando en ${delay}ms (code=${code ?? "?"})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (handle) {
      try {
        handle.sock.end(undefined);
      } catch {
        // ignorar errores de cierre de un socket ya muerto
      }
      handle = null;
    }
    start();
  }, delay);
}

export async function start(): Promise<void> {
  if (starting) return;
  starting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version: [number, number, number] | undefined;
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
      console.log(`[bot] usando versión Baileys/WA Web ${version.join(".")}`);
    } catch (err) {
      console.warn("[bot] no se pudo obtener la última versión:", err);
    }

    const current = getConnectionState();
    if (current.status === "disconnected") {
      setConnectionState({ status: "connecting" });
    }

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      // Use a browser tuple that advertises WEB_BROWSER instead of a desktop
      // tuple. Desktop tuples (WIN32/DARWIN) can cause WhatsApp to terminate the
      // connection early with status 428 before QR generation.
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false,
      syncFullHistory: true,
    });

    handle = { sock };

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      console.log("[bot] connection.update", JSON.stringify(update, null, 2));
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("[bot] nuevo QR generado, escaneá desde el dashboard");
        qrcodeTerminal.generate(qr, { small: true });
        setConnectionState({ status: "qr", qr_string: qr, phone: null });
      }

      if (connection === "connecting") {
        const state = getConnectionState();
        if (state.status === "disconnected") {
          setConnectionState({ status: "connecting" });
        }
      }

      if (connection === "open") {
        const phone = extractPhone(sock.user?.id);
        console.log(`[bot] conectado como ${phone ?? "desconocido"}`);
        setConnectionState({ status: "connected", qr_string: null, phone });
      }

      if (connection === "close") {
        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } }
        )?.output?.statusCode;
        console.warn("[bot] lastDisconnect error:", JSON.stringify(lastDisconnect?.error, null, 2));

        if (statusCode === DisconnectReason.loggedOut) {
          console.warn("[bot] sesión cerrada (logged out), generando nuevo QR...");
          setConnectionState({ status: "disconnected", qr_string: null, phone: null });
          handle = null;
          if (!shuttingDown) {
            start().catch((err) => console.error("[bot] error reiniciando tras logout:", err));
          }
          return;
        }

        console.warn(`[bot] conexión cerrada (code=${statusCode ?? "?"}), reconectando...`);
        setConnectionState({ status: "connecting", qr_string: null, phone: null });
        scheduleReconnect(statusCode);
      }
    });

    sock.ev.on("messages.upsert", (payload) => {
      console.log(`[bot] ← EVENT: messages.upsert type="${payload.type}", messages=${payload.messages.length}`);
      handleIncomingMessages(sock, payload).catch((err) => {
        console.error("[bot] error procesando mensajes entrantes:", err);
      });
    });
  } finally {
    starting = false;
  }
}

export async function shutdown(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  shuttingDown = true;
  try {
    if (handle) {
      try {
        await handle.sock.logout();
      } catch {
        // puede fallar si ya no hay sesión activa; no es crítico
      }
      try {
        handle.sock.end(undefined);
      } catch {
        // idem
      }
      handle = null;
    }
  } finally {
    shuttingDown = false;
  }
}

export function getHandle(): BaileysHandle | null {
  return handle;
}

export { AUTH_DIR };
