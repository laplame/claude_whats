import path from "node:path";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState as loadMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { getConnectionState, setConnectionState } from "../db";
import { botLog, disconnectSummary } from "../bot-log";
import { handleIncomingMessages, handleHistorySync } from "./handler";

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" });

export interface BaileysHandle {
  sock: WASocket;
}

interface TenantState {
  handle: BaileysHandle | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectCount: number;
  lastReconnectLogAt: number;
  starting: boolean;
  shuttingDown: boolean;
}

const tenants = new Map<number, TenantState>();

function tenantState(ownerId: number): TenantState {
  let t = tenants.get(ownerId);
  if (!t) {
    t = {
      handle: null,
      reconnectTimer: null,
      reconnectCount: 0,
      lastReconnectLogAt: 0,
      starting: false,
      shuttingDown: false,
    };
    tenants.set(ownerId, t);
  }
  return t;
}

export function authDirFor(ownerId: number): string {
  return path.resolve(process.cwd(), "auth", String(ownerId));
}

export function getKnownOwnerIds(): number[] {
  return [...tenants.keys()];
}

function extractPhone(jidOrId: string | undefined | null): string | null {
  if (!jidOrId) return null;
  const withoutSuffix = jidOrId.split(":")[0];
  return withoutSuffix.split("@")[0] || null;
}

function scheduleReconnect(ownerId: number, code: number | undefined) {
  const t = tenantState(ownerId);
  if (t.reconnectTimer) return;
  const delay = code === 440 ? 15000 : 5000;
  t.reconnectCount += 1;
  const now = Date.now();
  if (t.reconnectCount === 1 || now - t.lastReconnectLogAt >= 60_000) {
    t.lastReconnectLogAt = now;
    botLog.warn(
      `[owner ${ownerId}] reconectando en ${delay}ms (code=${code ?? "?"}, intento #${t.reconnectCount})`
    );
  }
  t.reconnectTimer = setTimeout(() => {
    t.reconnectTimer = null;
    if (t.handle) {
      try {
        t.handle.sock.end(undefined);
      } catch {
        // ignorar errores de cierre de un socket ya muerto
      }
      t.handle = null;
    }
    start(ownerId);
  }, delay);
}

export async function start(
  ownerId: number,
  version?: [number, number, number]
): Promise<void> {
  const t = tenantState(ownerId);
  if (t.starting) return;
  t.starting = true;
  try {
    const { state, saveCreds } = await loadMultiFileAuthState(authDirFor(ownerId));

    let resolvedVersion = version;
    if (!resolvedVersion) {
      try {
        const fetched = await fetchLatestBaileysVersion();
        resolvedVersion = fetched.version;
        botLog.info(`[owner ${ownerId}] usando versión Baileys/WA Web ${resolvedVersion.join(".")}`);
      } catch (err) {
        botLog.warn(`[owner ${ownerId}] no se pudo obtener la última versión:`, err);
      }
    }

    const current = getConnectionState(ownerId);
    if (current.status === "disconnected") {
      setConnectionState(ownerId, { status: "connecting" });
    }

    const sock = makeWASocket({
      version: resolvedVersion,
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

    t.handle = { sock };

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        botLog.info(`[owner ${ownerId}] nuevo QR generado, escaneá desde el dashboard`);
        qrcodeTerminal.generate(qr, { small: true });
        setConnectionState(ownerId, { status: "qr", qr_string: qr, phone: null });
      }

      if (connection === "connecting") {
        const state = getConnectionState(ownerId);
        if (state.status === "disconnected") {
          setConnectionState(ownerId, { status: "connecting" });
        }
      }

      if (connection === "open") {
        t.reconnectCount = 0;
        const phone = extractPhone(sock.user?.id);
        botLog.info(`[owner ${ownerId}] conectado como ${phone ?? "desconocido"}`);
        setConnectionState(ownerId, { status: "connected", qr_string: null, phone });
      }

      if (connection === "close") {
        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } }
        )?.output?.statusCode;
        botLog.warn(`[owner ${ownerId}] desconectado: ${disconnectSummary(lastDisconnect?.error)}`);

        if (statusCode === DisconnectReason.loggedOut) {
          botLog.warn(`[owner ${ownerId}] sesión cerrada (logged out), generando nuevo QR...`);
          setConnectionState(ownerId, { status: "disconnected", qr_string: null, phone: null });
          t.handle = null;
          if (!t.shuttingDown) {
            start(ownerId, resolvedVersion).catch((err) =>
              botLog.error(`[owner ${ownerId}] error reiniciando tras logout:`, err)
            );
          }
          return;
        }

        setConnectionState(ownerId, { status: "connecting", qr_string: null, phone: null });
        scheduleReconnect(ownerId, statusCode);
      }
    });

    sock.ev.on("messages.upsert", (payload) => {
      handleIncomingMessages(sock, payload, ownerId).catch((err) => {
        botLog.error(`[owner ${ownerId}] error procesando mensajes entrantes:`, err);
      });
    });

    sock.ev.on("messaging-history.set", ({ messages }) => {
      if (!messages?.length) return;
      handleHistorySync(sock, messages, ownerId).catch((err) => {
        botLog.error(`[owner ${ownerId}] error importando historial:`, err);
      });
    });
  } finally {
    t.starting = false;
  }
}

export async function shutdown(ownerId: number): Promise<void> {
  const t = tenantState(ownerId);
  if (t.reconnectTimer) {
    clearTimeout(t.reconnectTimer);
    t.reconnectTimer = null;
  }
  t.shuttingDown = true;
  try {
    if (t.handle) {
      try {
        await t.handle.sock.logout();
      } catch {
        // puede fallar si ya no hay sesión activa; no es crítico
      }
      try {
        t.handle.sock.end(undefined);
      } catch {
        // idem
      }
      t.handle = null;
    }
  } finally {
    t.shuttingDown = false;
  }
}

export function getHandle(ownerId: number): BaileysHandle | null {
  return tenants.get(ownerId)?.handle ?? null;
}
