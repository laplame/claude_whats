import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { mirrorDeleteConversation, mirrorUpsert } from "./mongo";
import { filterBotContextFiles } from "./context-files";
import { normalizePhone, phoneLookupVariants, isLikelyLidPhone, phonesMatch } from "./phone";
import { hashPasscode } from "./passcode";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "messages.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// PM2 arranca whats-claude-bot y whats-claude-web casi al mismo tiempo, y
// ambos importan este módulo por separado. En el primer deploy sobre una
// base vieja (sin owner_id), los dos procesos pueden intentar correr la
// migración de esquema a la vez; sin busy_timeout, SQLite tira SQLITE_BUSY
// de inmediato en vez de esperar a que el otro proceso termine su escritura.
db.pragma("busy_timeout = 5000");

// Tablas de auth del dashboard. Viven acá (no en auth.ts) para que
// cualquier entrypoint que importe db.ts (incluido scripts/start-bot.ts,
// que nunca importa auth.ts) tenga garantizado que dashboard_users existe
// antes de que corran las migraciones de owner_id de abajo.
db.exec(`
CREATE TABLE IF NOT EXISTS dashboard_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  whatsapp TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT,
  passcode_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS dashboard_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_user ON dashboard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_expires ON dashboard_sessions(expires_at);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  remote_jid TEXT,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  context_files TEXT NOT NULL DEFAULT '[]',
  last_message_at INTEGER,
  human_takeover_at INTEGER,
  appointment_at INTEGER,
  appointment_status TEXT CHECK(appointment_status IN ('AGENDADA','CONFIRMADA','COMPLETADA','NO_SHOW','CANCELADA')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(owner_id, phone)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS connection_state (
  owner_id INTEGER PRIMARY KEY REFERENCES dashboard_users(id) ON DELETE CASCADE,
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
    NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS lid_mappings (
  owner_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  lid_jid TEXT NOT NULL,
  phone_jid TEXT NOT NULL,
  PRIMARY KEY (owner_id, lid_jid),
  UNIQUE(owner_id, phone_jid)
);

CREATE TABLE IF NOT EXISTS connection_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  command TEXT NOT NULL CHECK(command IN ('disconnect')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  processed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_connection_commands_pending
  ON connection_commands(processed_at, created_at);
`);

// Migración best-effort para bases creadas antes de agregar estas columnas
// (CREATE TABLE IF NOT EXISTS no altera tablas ya existentes).
const dashboardUserColumns = new Set(
  (db.prepare("PRAGMA table_info(dashboard_users)").all() as { name: string }[]).map((c) => c.name)
);
if (dashboardUserColumns.size > 0 && !dashboardUserColumns.has("role")) {
  db.exec("ALTER TABLE dashboard_users ADD COLUMN role TEXT");
}

const conversationColumns = new Set(
  (db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[]).map((c) => c.name)
);
if (conversationColumns.size > 0) {
  if (!conversationColumns.has("notes")) {
    db.exec("ALTER TABLE conversations ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  }
  if (!conversationColumns.has("tags")) {
    db.exec("ALTER TABLE conversations ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  }
  if (!conversationColumns.has("context_files")) {
    db.exec("ALTER TABLE conversations ADD COLUMN context_files TEXT NOT NULL DEFAULT '[]'");
  }
  if (!conversationColumns.has("remote_jid")) {
    db.exec("ALTER TABLE conversations ADD COLUMN remote_jid TEXT");
  }
  if (!conversationColumns.has("human_takeover_at")) {
    db.exec("ALTER TABLE conversations ADD COLUMN human_takeover_at INTEGER");
  }
  if (!conversationColumns.has("appointment_at")) {
    db.exec("ALTER TABLE conversations ADD COLUMN appointment_at INTEGER");
  }
  if (!conversationColumns.has("appointment_status")) {
    db.exec("ALTER TABLE conversations ADD COLUMN appointment_status TEXT");
  }
}

/**
 * Devuelve el id del primer `dashboard_users`, creándolo desde las env vars
 * AUTH_ADMIN_* si la tabla está vacía. Existe acá (duplicando el mismo
 * fallback que `ensureSeedAdminUser` en auth.ts) porque las migraciones de
 * `owner_id` de abajo necesitan un dueño válido incluso cuando el primer
 * proceso en tocar la base es el bot (que nunca importa auth.ts).
 */
function ensureLegacyOwnerId(): number {
  const existing = db
    .prepare("SELECT id FROM dashboard_users ORDER BY id ASC LIMIT 1")
    .get() as { id: number } | undefined;
  if (existing) return existing.id;

  const email = (process.env.AUTH_ADMIN_EMAIL?.trim() || "admin@local").toLowerCase();
  const whatsapp = normalizePhone(process.env.AUTH_ADMIN_WHATSAPP?.trim() || "5210000000000");
  const passcode = process.env.AUTH_ADMIN_PASSCODE?.trim() || "8044";
  const name = process.env.AUTH_ADMIN_NAME?.trim() || "Admin";

  const result = db
    .prepare(
      "INSERT INTO dashboard_users (email, whatsapp, name, passcode_hash) VALUES (?, ?, ?, ?)"
    )
    .run(email, whatsapp, name, hashPasscode(passcode));
  return result.lastInsertRowid as number;
}

// --- Migraciones de esquema multi-tenant (agregan owner_id a bases creadas
// antes de este cambio). Cada bloque solo corre si la tabla existe con el
// esquema viejo (sin owner_id); en instalaciones nuevas los CREATE TABLE de
// arriba ya crean el esquema correcto y estos bloques son no-ops.

const conversationsHasOwner = conversationColumns.has("owner_id");
if (conversationColumns.size > 0 && !conversationsHasOwner) {
  const legacyOwnerId = ensureLegacyOwnerId();
  // messages.conversation_id REFERENCES conversations(id): con foreign_keys
  // ON, DROP TABLE conversations dispara un delete implícito por fila que
  // choca contra esa FK. Se desactiva (fuera de la transacción, SQLite no
  // permite cambiar el pragma dentro de un BEGIN) solo durante el rebuild.
  db.pragma("foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE conversations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        remote_jid TEXT,
        name TEXT,
        mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
        notes TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        context_files TEXT NOT NULL DEFAULT '[]',
        last_message_at INTEGER,
        human_takeover_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(owner_id, phone)
      );
    `);
    db.prepare(
      `INSERT INTO conversations_new
        (id, owner_id, phone, remote_jid, name, mode, notes, tags, context_files, last_message_at, human_takeover_at, created_at)
       SELECT id, ?, phone, remote_jid, name, mode, notes, tags, context_files, last_message_at, human_takeover_at, created_at
       FROM conversations`
    ).run(legacyOwnerId);
    db.exec("DROP TABLE conversations");
    db.exec("ALTER TABLE conversations_new RENAME TO conversations");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

db.exec(`
CREATE INDEX IF NOT EXISTS idx_conversations_remote_jid ON conversations(remote_jid);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);
`);

const connectionStateColumns = new Set(
  (db.prepare("PRAGMA table_info(connection_state)").all() as { name: string }[]).map((c) => c.name)
);
if (connectionStateColumns.size > 0 && !connectionStateColumns.has("owner_id")) {
  const legacyOwnerId = ensureLegacyOwnerId();
  const old = db
    .prepare("SELECT status, qr_string, phone FROM connection_state WHERE id = 1")
    .get() as { status: string; qr_string: string | null; phone: string | null } | undefined;
  db.exec("DROP TABLE connection_state");
  db.exec(`
    CREATE TABLE connection_state (
      owner_id INTEGER PRIMARY KEY REFERENCES dashboard_users(id) ON DELETE CASCADE,
      status TEXT CHECK(status IN ('disconnected','qr','connecting','connected')) NOT NULL DEFAULT 'disconnected',
      qr_string TEXT,
      phone TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  if (old) {
    db.prepare(
      "INSERT INTO connection_state (owner_id, status, qr_string, phone) VALUES (?, ?, ?, ?)"
    ).run(legacyOwnerId, old.status, old.qr_string, old.phone);
  }
}

const outboxColumns = new Set(
  (db.prepare("PRAGMA table_info(outbox)").all() as { name: string }[]).map((c) => c.name)
);
if (outboxColumns.size > 0 && !outboxColumns.has("owner_id")) {
  db.exec("ALTER TABLE outbox ADD COLUMN owner_id INTEGER REFERENCES dashboard_users(id)");
  db.exec(
    "UPDATE outbox SET owner_id = (SELECT owner_id FROM conversations WHERE conversations.id = outbox.conversation_id)"
  );
}
// Corre después de la migración (no en el CREATE TABLE inicial): en bases
// viejas `outbox` ya existía sin owner_id, así que el CREATE TABLE IF NOT
// EXISTS de arriba es un no-op y este índice solo puede crearse una vez que
// la columna existe de verdad (recién agregada o ya presente desde el inicio).
db.exec("CREATE INDEX IF NOT EXISTS idx_outbox_owner_pending ON outbox(owner_id, sent, created_at)");

const lidMappingColumns = new Set(
  (db.prepare("PRAGMA table_info(lid_mappings)").all() as { name: string }[]).map((c) => c.name)
);
if (lidMappingColumns.size > 0 && !lidMappingColumns.has("owner_id")) {
  const legacyOwnerId = ensureLegacyOwnerId();
  db.exec(`
    CREATE TABLE lid_mappings_new (
      owner_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
      lid_jid TEXT NOT NULL,
      phone_jid TEXT NOT NULL,
      PRIMARY KEY (owner_id, lid_jid),
      UNIQUE(owner_id, phone_jid)
    );
  `);
  db.prepare(
    "INSERT INTO lid_mappings_new (owner_id, lid_jid, phone_jid) SELECT ?, lid_jid, phone_jid FROM lid_mappings"
  ).run(legacyOwnerId);
  db.exec("DROP TABLE lid_mappings");
  db.exec("ALTER TABLE lid_mappings_new RENAME TO lid_mappings");
}

export type Mode = "AI" | "HUMAN";
export type MessageRole = "user" | "assistant" | "human";
export type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";
export type AppointmentStatus = "AGENDADA" | "CONFIRMADA" | "COMPLETADA" | "NO_SHOW" | "CANCELADA";

export const HUMAN_MODE_TIMEOUT_MINUTES =
  Number(process.env.HUMAN_MODE_TIMEOUT_MINUTES) || 30;
const HUMAN_MODE_TIMEOUT_SECONDS = HUMAN_MODE_TIMEOUT_MINUTES * 60;

export interface Conversation {
  id: number;
  owner_id: number;
  phone: string;
  remote_jid: string | null;
  name: string | null;
  mode: Mode;
  notes: string;
  tags: string[];
  context_files: string[];
  last_message_at: number | null;
  human_takeover_at: number | null;
  appointment_at: number | null;
  appointment_status: AppointmentStatus | null;
  created_at: number;
}

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string | null;
  last_message_role: MessageRole | null;
  human_mode_expires_at: number | null;
}

interface ConversationRow {
  id: number;
  owner_id: number;
  phone: string;
  remote_jid?: string | null;
  name: string | null;
  mode: Mode;
  notes: string;
  tags: string;
  context_files?: string;
  last_message_at: number | null;
  human_takeover_at?: number | null;
  appointment_at?: number | null;
  appointment_status?: AppointmentStatus | null;
  created_at: number;
  last_message_preview?: string | null;
  last_message_role?: MessageRole | null;
}

function mapConversationRow(row: ConversationRow): Conversation {
  let tags: string[];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }
  let context_files: string[] = [];
  try {
    context_files = row.context_files ? JSON.parse(row.context_files) : [];
  } catch {
    context_files = [];
  }
  return {
    ...row,
    tags,
    context_files: filterBotContextFiles(context_files),
    remote_jid: row.remote_jid ?? null,
    human_takeover_at: row.human_takeover_at ?? null,
    appointment_at: row.appointment_at ?? null,
    appointment_status: row.appointment_status ?? null,
  };
}

export function getContextFiles(conversationId: number): string[] {
  const row = db
    .prepare("SELECT context_files FROM conversations WHERE id = ?")
    .get(conversationId) as { context_files?: string } | undefined;
  if (!row || !row.context_files) return [];
  try {
    return filterBotContextFiles(JSON.parse(row.context_files));
  } catch {
    return [];
  }
}

export function attachContextFile(conversationId: number, filename: string): void {
  const files = getContextFiles(conversationId);
  if (files.includes(filename)) return;
  files.push(filename);
  db.prepare("UPDATE conversations SET context_files = ? WHERE id = ?").run(JSON.stringify(files), conversationId);
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
}

export function detachContextFile(conversationId: number, filename: string): void {
  const files = getContextFiles(conversationId);
  const next = files.filter((f) => f !== filename);
  db.prepare("UPDATE conversations SET context_files = ? WHERE id = ?").run(JSON.stringify(next), conversationId);
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
}

/** Desvincula `filename` de todas las conversaciones DE UN dueño (no cruza tenants). */
export function detachContextFileFromAll(ownerId: number, filename: string): void {
  const rows = db
    .prepare("SELECT id, context_files FROM conversations WHERE owner_id = ?")
    .all(ownerId) as { id: number; context_files: string }[];

  for (const row of rows) {
    let files: string[] = [];
    try {
      files = row.context_files ? JSON.parse(row.context_files) : [];
    } catch {
      files = [];
    }
    if (files.includes(filename)) {
      detachContextFile(row.id, filename);
    }
  }
}

export interface Message {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  created_at: number;
}

export interface ConnectionState {
  owner_id: number;
  status: ConnectionStatus;
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface ConnectionStateUpdate {
  status?: ConnectionStatus;
  qr_string?: string | null;
  phone?: string | null;
}

export interface OutboxItem {
  id: number;
  owner_id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

export interface ConnectionCommand {
  id: number;
  owner_id: number;
  command: "disconnect";
  created_at: number;
  processed_at: number | null;
}

export function listDashboardUserIds(): number[] {
  return (db.prepare("SELECT id FROM dashboard_users ORDER BY id ASC").all() as { id: number }[]).map(
    (r) => r.id
  );
}

export function getConversationByRemoteJid(ownerId: number, remoteJid: string): Conversation | null {
  const row = db
    .prepare("SELECT * FROM conversations WHERE owner_id = ? AND remote_jid = ?")
    .get(ownerId, remoteJid) as ConversationRow | undefined;
  return row ? mapConversationRow(row) : null;
}

export function upsertLidMapping(ownerId: number, lidJid: string, phoneJid: string): void {
  db.prepare(
    `INSERT INTO lid_mappings (owner_id, lid_jid, phone_jid) VALUES (?, ?, ?)
     ON CONFLICT(owner_id, lid_jid) DO UPDATE SET phone_jid = excluded.phone_jid`
  ).run(ownerId, lidJid, phoneJid);

  const byLid = getConversationByRemoteJid(ownerId, lidJid);
  const byPhone = getConversationByRemoteJid(ownerId, phoneJid);
  if (!byLid || !byPhone || byLid.id === byPhone.id) return;

  const botPhone = getConnectionState(ownerId).phone;
  const lidRow = db.prepare("SELECT * FROM conversations WHERE id = ?").get(byLid.id) as ConversationRow;
  const phoneRow = db.prepare("SELECT * FROM conversations WHERE id = ?").get(byPhone.id) as ConversationRow;
  const { keep, drop } = pickConversationToKeep(lidRow, phoneRow, botPhone);
  mergeConversations(keep.id, drop.id);
  db.prepare("UPDATE conversations SET remote_jid = ? WHERE id = ?").run(phoneJid, keep.id);
}

function getLinkedPhoneJid(ownerId: number, lidJid: string): string | null {
  const row = db
    .prepare("SELECT phone_jid FROM lid_mappings WHERE owner_id = ? AND lid_jid = ?")
    .get(ownerId, lidJid) as { phone_jid?: string } | undefined;
  return row?.phone_jid ?? null;
}

function getLinkedLidJid(ownerId: number, phoneJid: string): string | null {
  const row = db
    .prepare("SELECT lid_jid FROM lid_mappings WHERE owner_id = ? AND phone_jid = ?")
    .get(ownerId, phoneJid) as { lid_jid?: string } | undefined;
  return row?.lid_jid ?? null;
}

function phoneToWaJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function preferRemoteJid(
  current: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  if (!incoming) return current ?? null;
  if (!current) return incoming;
  if (current.endsWith("@lid") && !incoming.endsWith("@lid")) return incoming;
  if (!current.endsWith("@lid") && incoming.endsWith("@lid")) return current;
  return incoming;
}

/** Busca el hilo existente por remote_jid, mapeo LID↔teléfono o número, dentro del owner. */
function findConversationRow(
  ownerId: number,
  phone: string,
  remoteJid?: string | null
): ConversationRow | undefined {
  if (remoteJid) {
    const direct = db
      .prepare("SELECT * FROM conversations WHERE owner_id = ? AND remote_jid = ?")
      .get(ownerId, remoteJid) as ConversationRow | undefined;
    if (direct) return direct;

    const linkedLid = getLinkedLidJid(ownerId, remoteJid);
    if (linkedLid) {
      const viaLid = db
        .prepare("SELECT * FROM conversations WHERE owner_id = ? AND remote_jid = ?")
        .get(ownerId, linkedLid) as ConversationRow | undefined;
      if (viaLid) return viaLid;
    }

    if (remoteJid.endsWith("@lid")) {
      const linkedPhone = getLinkedPhoneJid(ownerId, remoteJid);
      if (linkedPhone) {
        const viaPhone = db
          .prepare("SELECT * FROM conversations WHERE owner_id = ? AND remote_jid = ?")
          .get(ownerId, linkedPhone) as ConversationRow | undefined;
        if (viaPhone) return viaPhone;
      }
    }
  }

  if (!isLikelyLidPhone(phone)) {
    const phoneJid = phoneToWaJid(phone);
    const viaMapping = db
      .prepare(
        `SELECT c.* FROM conversations c
         INNER JOIN lid_mappings m ON c.remote_jid = m.lid_jid AND m.owner_id = c.owner_id
         WHERE c.owner_id = ? AND m.phone_jid = ?
         LIMIT 1`
      )
      .get(ownerId, phoneJid) as ConversationRow | undefined;
    if (viaMapping) return viaMapping;

    const variants = phoneLookupVariants(phone);
    const placeholders = variants.map(() => "?").join(", ");
    return db
      .prepare(`SELECT * FROM conversations WHERE owner_id = ? AND phone IN (${placeholders}) LIMIT 1`)
      .get(ownerId, ...variants) as ConversationRow | undefined;
  }

  return undefined;
}

function shouldPreferContactName(incoming: string, current: string): boolean {
  if (current.includes("/") && !incoming.includes("/")) return true;
  if (current.toLowerCase().includes("bizn") && !incoming.toLowerCase().includes("bizn")) return true;
  if (current.toLowerCase().includes("damecodigo") && !incoming.toLowerCase().includes("damecodigo")) {
    return true;
  }
  return false;
}

function applyConversationUpdates(
  existing: ConversationRow,
  canonical: string,
  name: string | null | undefined,
  remoteJid: string | null | undefined
): Conversation {
  let changed = false;

  if (existing.phone !== canonical && !isLikelyLidPhone(canonical)) {
    existing.phone = canonical;
    changed = true;
  } else if (isLikelyLidPhone(existing.phone) && !isLikelyLidPhone(canonical)) {
    existing.phone = canonical;
    changed = true;
  }

  if (name) {
    if (!existing.name) {
      existing.name = name;
      changed = true;
    } else if (shouldPreferContactName(name, existing.name)) {
      existing.name = name;
      changed = true;
    }
  }

  if (remoteJid) {
    const preferred = preferRemoteJid(existing.remote_jid, remoteJid);
    if (preferred && existing.remote_jid !== preferred) {
      existing.remote_jid = preferred;
      changed = true;
    }
  }

  if (!changed) {
    return mapConversationRow(existing);
  }

  db.prepare("UPDATE conversations SET phone = ?, name = ?, remote_jid = ? WHERE id = ?").run(
    existing.phone,
    existing.name,
    existing.remote_jid ?? null,
    existing.id
  );
  const updated = mapConversationRow(existing);
  mirrorUpsert("conversations", updated.id, updated);
  return updated;
}

export function getOrCreateConversation(
  ownerId: number,
  phone: string,
  name?: string | null,
  remoteJid?: string | null
): Conversation {
  const canonical = normalizePhone(phone);
  const existing = findConversationRow(ownerId, canonical, remoteJid);

  if (existing) {
    return applyConversationUpdates(existing, canonical, name, remoteJid);
  }

  const result = db
    .prepare("INSERT INTO conversations (owner_id, phone, name, remote_jid) VALUES (?, ?, ?, ?)")
    .run(ownerId, canonical, name ?? null, remoteJid ?? null);

  const created = getConversationById(result.lastInsertRowid as number)!;
  mirrorUpsert("conversations", created.id, created);
  return created;
}

/** Si se pasa `ownerId`, además verifica dueño (devuelve null si no coincide). */
export function getConversationById(id: number, ownerId?: number): Conversation | null {
  const row = (
    ownerId !== undefined
      ? db.prepare("SELECT * FROM conversations WHERE id = ? AND owner_id = ?").get(id, ownerId)
      : db.prepare("SELECT * FROM conversations WHERE id = ?").get(id)
  ) as ConversationRow | undefined;
  return row ? mapConversationRow(row) : null;
}

const insertMessageTxn = db.transaction(
  (conversationId: number, role: MessageRole, content: string, createdAt?: number) => {
    const ts = createdAt ?? Math.floor(Date.now() / 1000);
    const result = db
      .prepare(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(conversationId, role, content, ts);

    db.prepare(
      "UPDATE conversations SET last_message_at = ? WHERE id = ?"
    ).run(ts, conversationId);

    return result.lastInsertRowid as number;
  }
);

export function insertMessage(
  conversationId: number,
  role: MessageRole,
  content: string,
  createdAt?: number
): number {
  const id = insertMessageTxn(conversationId, role, content, createdAt) as number;

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message;
  mirrorUpsert("messages", id, row);

  const conversation = getConversationById(conversationId);
  if (conversation) {
    mirrorUpsert("conversations", conversation.id, conversation);
  }

  return id;
}

export function getMessages(conversationId: number, limit = 100): Message[] {
  const rows = db
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?"
    )
    .all(conversationId, limit) as Message[];
  return rows.reverse();
}

export function getRecentHistory(
  conversationId: number,
  limit = 20
): Message[] {
  return getMessages(conversationId, limit);
}

export function hasRecentHumanMessage(
  conversationId: number,
  content: string,
  seconds = 5
): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM messages WHERE conversation_id = ? AND role = 'human' AND content = ? AND created_at >= unixepoch() - ? LIMIT 1"
    )
    .get(conversationId, content, seconds) as { '1'?: number } | undefined;
  return Boolean(row);
}

export function hasRecentAssistantMessage(
  conversationId: number,
  content: string,
  seconds = 5
): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM messages WHERE conversation_id = ? AND role = 'assistant' AND content = ? AND created_at >= unixepoch() - ? LIMIT 1"
    )
    .get(conversationId, content, seconds) as { '1'?: number } | undefined;
  return Boolean(row);
}

/**
 * Único punto de mutación de `mode`. Al pasar a HUMAN (a mano desde el
 * toggle o por actividad humana real) se (re)inicia la cuenta regresiva de
 * `human_takeover_at`; al volver a AI se limpia. Así el modo manual y el
 * disparado por actividad comparten un mismo timeout.
 */
export function setMode(conversationId: number, mode: Mode): void {
  if (mode === "HUMAN") {
    db.prepare(
      "UPDATE conversations SET mode = 'HUMAN', human_takeover_at = unixepoch() WHERE id = ?"
    ).run(conversationId);
  } else {
    db.prepare(
      "UPDATE conversations SET mode = 'AI', human_takeover_at = NULL WHERE id = ?"
    ).run(conversationId);
  }
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
}

/** Reactiva a AI las conversaciones cuyo timeout de modo Humano ya venció (todas las cuentas). */
export function reactivateExpiredHumanModes(): number {
  const cutoff = Math.floor(Date.now() / 1000) - HUMAN_MODE_TIMEOUT_SECONDS;
  const rows = db
    .prepare(
      "SELECT id FROM conversations WHERE mode = 'HUMAN' AND human_takeover_at IS NOT NULL AND human_takeover_at <= ?"
    )
    .all(cutoff) as { id: number }[];

  for (const { id } of rows) {
    setMode(id, "AI");
  }

  return rows.length;
}

export function reconcileConversationTimestamps(): void {
  db.exec(`
    UPDATE conversations
    SET last_message_at = (
      SELECT MAX(created_at) FROM messages WHERE messages.conversation_id = conversations.id
    )
    WHERE EXISTS (
      SELECT 1 FROM messages WHERE messages.conversation_id = conversations.id
    )
  `);
}

export function listConversations(ownerId: number): ConversationWithPreview[] {
  reactivateExpiredHumanModes();
  reconcileDuplicateConversations(ownerId);
  reconcileConversationTimestamps();

  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT content FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_preview,
        (SELECT role FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_role,
        COALESCE(
          (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
          c.last_message_at,
          c.created_at
        ) AS sort_at
      FROM conversations c
      WHERE c.owner_id = ?
      ORDER BY sort_at DESC, c.id DESC`
    )
    .all(ownerId) as (ConversationRow & { sort_at?: number })[];

  return rows.map((row) => ({
    ...mapConversationRow(row),
    last_message_preview: row.last_message_preview ?? null,
    last_message_role: row.last_message_role ?? null,
    last_message_at: row.sort_at ?? row.last_message_at,
    human_mode_expires_at:
      row.mode === "HUMAN" && row.human_takeover_at
        ? row.human_takeover_at + HUMAN_MODE_TIMEOUT_SECONDS
        : null,
  }));
}

export function setNotes(conversationId: number, notes: string): void {
  db.prepare("UPDATE conversations SET notes = ? WHERE id = ?").run(
    notes,
    conversationId
  );
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
}

export function setTags(conversationId: number, tags: string[]): void {
  db.prepare("UPDATE conversations SET tags = ? WHERE id = ?").run(
    JSON.stringify(tags),
    conversationId
  );
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
}

/** Agenda/reagenda (o limpia, pasando ambos en null) el turno de una conversación. */
export function setAppointment(
  conversationId: number,
  appointmentAt: number | null,
  status: AppointmentStatus | null
): void {
  db.prepare(
    "UPDATE conversations SET appointment_at = ?, appointment_status = ? WHERE id = ?"
  ).run(appointmentAt, status, conversationId);
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
}

/** Devuelve la fila del owner, creándola en 'disconnected' si todavía no existe. */
export function getConnectionState(ownerId: number): ConnectionState {
  db.prepare("INSERT OR IGNORE INTO connection_state (owner_id, status) VALUES (?, 'disconnected')").run(
    ownerId
  );
  return db.prepare("SELECT * FROM connection_state WHERE owner_id = ?").get(ownerId) as ConnectionState;
}

export function setConnectionState(ownerId: number, update: ConnectionStateUpdate): void {
  const current = getConnectionState(ownerId);
  const next = {
    status: "status" in update && update.status !== undefined
      ? update.status
      : current.status,
    qr_string: "qr_string" in update ? update.qr_string ?? null : current.qr_string,
    phone: "phone" in update ? update.phone ?? null : current.phone,
  };

  db.prepare(
    "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE owner_id = ?"
  ).run(next.status, next.qr_string, next.phone, ownerId);
}

export function enqueueConnectionCommand(ownerId: number, command: "disconnect"): number {
  const result = db
    .prepare("INSERT INTO connection_commands (owner_id, command) VALUES (?, ?)")
    .run(ownerId, command);
  return result.lastInsertRowid as number;
}

export function getPendingConnectionCommands(): ConnectionCommand[] {
  return db
    .prepare("SELECT * FROM connection_commands WHERE processed_at IS NULL ORDER BY id ASC")
    .all() as ConnectionCommand[];
}

export function markConnectionCommandProcessed(id: number): void {
  db.prepare("UPDATE connection_commands SET processed_at = unixepoch() WHERE id = ?").run(id);
}

export function enqueueOutbox(
  ownerId: number,
  conversationId: number,
  phone: string,
  content: string
): number {
  const result = db
    .prepare(
      "INSERT INTO outbox (owner_id, conversation_id, phone, content) VALUES (?, ?, ?, ?)"
    )
    .run(ownerId, conversationId, phone, content);
  return result.lastInsertRowid as number;
}

export function getPendingOutbox(ownerId: number, limit = 20): OutboxItem[] {
  return db
    .prepare("SELECT * FROM outbox WHERE owner_id = ? AND sent = 0 ORDER BY created_at ASC LIMIT ?")
    .all(ownerId, limit) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}

const deleteConversationTxn = db.transaction((id: number) => {
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
});

export function deleteConversation(id: number): void {
  deleteConversationTxn(id);
  mirrorDeleteConversation(id);
}

export function getConversationByPhone(ownerId: number, phone: string): Conversation | null {
  const variants = phoneLookupVariants(phone);
  const placeholders = variants.map(() => "?").join(", ");
  const row = db
    .prepare(`SELECT * FROM conversations WHERE owner_id = ? AND phone IN (${placeholders}) LIMIT 1`)
    .get(ownerId, ...variants) as ConversationRow | undefined;
  return row ? mapConversationRow(row) : null;
}

const mergeConversationsTxn = db.transaction((keepId: number, dropId: number) => {
  const keep = getConversationById(keepId);
  const drop = getConversationById(dropId);

  if (keep && drop) {
    const context_files = [...new Set([...keep.context_files, ...drop.context_files])];
    const tags = [...new Set([...keep.tags, ...drop.tags])];
    const notes = keep.notes || drop.notes;
    const remote_jid = preferRemoteJid(keep.remote_jid, drop.remote_jid);
    const name = keep.name || drop.name;
    const appointment_at = keep.appointment_at ?? drop.appointment_at;
    const appointment_status = keep.appointment_status ?? drop.appointment_status;
    db.prepare(
      "UPDATE conversations SET context_files = ?, tags = ?, notes = ?, remote_jid = ?, name = ?, appointment_at = ?, appointment_status = ? WHERE id = ?"
    ).run(
      JSON.stringify(context_files),
      JSON.stringify(tags),
      notes,
      remote_jid,
      name,
      appointment_at,
      appointment_status,
      keepId
    );
  }

  db.prepare("UPDATE messages SET conversation_id = ? WHERE conversation_id = ?").run(keepId, dropId);
  db.prepare("UPDATE outbox SET conversation_id = ? WHERE conversation_id = ?").run(keepId, dropId);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(dropId);
});

/** No verifica dueño: los llamadores (rutas API o reconcile* interno) deben garantizar mismo owner. */
export function mergeConversations(keepId: number, dropId: number): void {
  if (keepId === dropId) return;
  mergeConversationsTxn(keepId, dropId);
  mirrorDeleteConversation(dropId);
  reconcileConversationTimestamps();
  const kept = getConversationById(keepId);
  if (kept) mirrorUpsert("conversations", kept.id, kept);
}

export function reconcilePhoneFormats(ownerId: number): number {
  const botPhone = getConnectionState(ownerId).phone;
  const rows = db.prepare("SELECT * FROM conversations WHERE owner_id = ?").all(ownerId) as ConversationRow[];
  const keepByCanonical = new Map<string, number>();
  let merged = 0;

  for (const row of rows) {
    if (!getConversationById(row.id)) continue;

    const canonical = normalizePhone(row.phone);
    const keepId = keepByCanonical.get(canonical);

    if (keepId === undefined) {
      if (row.phone !== canonical) {
        db.prepare("UPDATE conversations SET phone = ? WHERE id = ?").run(canonical, row.id);
      }
      keepByCanonical.set(canonical, row.id);
      continue;
    }

    if (keepId === row.id) continue;

    const keeper = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(keepId) as ConversationRow;
    const { keep, drop } = pickConversationToKeep(keeper, row, botPhone);
    mergeConversations(keep.id, drop.id);
    keepByCanonical.set(canonical, keep.id);
    merged += 1;
  }

  return merged;
}

function pickConversationToKeep(
  a: ConversationRow,
  b: ConversationRow,
  botPhone: string | null
): { keep: ConversationRow; drop: ConversationRow } {
  const aIsBot = Boolean(botPhone && phonesMatch(a.phone, botPhone));
  const bIsBot = Boolean(botPhone && phonesMatch(b.phone, botPhone));
  if (aIsBot && !bIsBot) return { keep: b, drop: a };
  if (bIsBot && !aIsBot) return { keep: a, drop: b };

  const aIsLid = isLikelyLidPhone(a.phone);
  const bIsLid = isLikelyLidPhone(b.phone);
  if (aIsLid && !bIsLid) return { keep: b, drop: a };
  if (bIsLid && !aIsLid) return { keep: a, drop: b };

  if (a.name && b.name && shouldPreferContactName(a.name, b.name)) {
    return { keep: a, drop: b };
  }
  if (a.name && b.name && shouldPreferContactName(b.name, a.name)) {
    return { keep: b, drop: a };
  }

  const aMsgs = (
    db.prepare("SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?").get(a.id) as {
      c: number;
    }
  ).c;
  const bMsgs = (
    db.prepare("SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?").get(b.id) as {
      c: number;
    }
  ).c;
  return aMsgs >= bMsgs ? { keep: a, drop: b } : { keep: b, drop: a };
}

function reconcileByRemoteJid(ownerId: number, botPhone: string | null): number {
  const rows = db
    .prepare("SELECT * FROM conversations WHERE owner_id = ? AND remote_jid IS NOT NULL AND remote_jid != ''")
    .all(ownerId) as ConversationRow[];
  const keepByJid = new Map<string, ConversationRow>();
  let merged = 0;

  for (const row of rows) {
    if (!getConversationById(row.id)) continue;
    const jid = row.remote_jid!;
    const existing = keepByJid.get(jid);

    if (!existing) {
      keepByJid.set(jid, row);
      continue;
    }

    const { keep, drop } = pickConversationToKeep(existing, row, botPhone);
    if (!getConversationById(drop.id)) continue;
    mergeConversations(keep.id, drop.id);
    keepByJid.set(jid, keep.id === existing.id ? existing : row);
    merged += 1;
  }

  return merged;
}

function reconcileMisfiledSelfPhone(ownerId: number, botPhone: string | null): number {
  if (!botPhone) return 0;

  const variants = phoneLookupVariants(botPhone);
  const placeholders = variants.map(() => "?").join(", ");
  const misfiled = db
    .prepare(`SELECT * FROM conversations WHERE owner_id = ? AND phone IN (${placeholders})`)
    .all(ownerId, ...variants) as ConversationRow[];

  let merged = 0;
  for (const bad of misfiled) {
    if (!getConversationById(bad.id)) continue;

    if (bad.remote_jid) {
      const match = db
        .prepare("SELECT * FROM conversations WHERE owner_id = ? AND remote_jid = ? AND id != ?")
        .get(ownerId, bad.remote_jid, bad.id) as ConversationRow | undefined;
      if (match) {
        const { keep, drop } = pickConversationToKeep(match, bad, botPhone);
        mergeConversations(keep.id, drop.id);
        merged += 1;
        continue;
      }
    }

    const partnerPhone = normalizePhone(bad.remote_jid?.split("@")[0]?.split(":")[0] ?? "");
    if (partnerPhone && !phonesMatch(partnerPhone, botPhone)) {
      const partner = getConversationByPhone(ownerId, partnerPhone);
      if (partner && partner.id !== bad.id) {
        mergeConversations(partner.id, bad.id);
        merged += 1;
      }
    }
  }

  return merged;
}

function reconcileLidDuplicatesByName(ownerId: number, botPhone: string | null): number {
  const rows = db.prepare("SELECT * FROM conversations WHERE owner_id = ?").all(ownerId) as ConversationRow[];
  const byName = new Map<string, ConversationRow[]>();
  let merged = 0;

  for (const row of rows) {
    if (!row.name?.trim() || !getConversationById(row.id)) continue;
    const key = row.name.trim().toLowerCase();
    const group = byName.get(key) ?? [];
    group.push(row);
    byName.set(key, group);
  }

  for (const group of byName.values()) {
    if (group.length < 2) continue;

    // Si ningún miembro del grupo tiene teléfono real (todos LID), igual
    // los fusionamos usando el primero como ancla: mismo pushName exacto
    // ya es una señal suficientemente fuerte, y sin esto dos sesiones LID
    // del mismo contacto quedarían duplicadas para siempre.
    const anchor = group.find((row) => !isLikelyLidPhone(row.phone)) ?? group[0];

    for (const row of group) {
      if (row.id === anchor.id) continue;
      if (!getConversationById(row.id) || !getConversationById(anchor.id)) continue;
      const { keep, drop } = pickConversationToKeep(anchor, row, botPhone);
      mergeConversations(keep.id, drop.id);
      merged += 1;
    }
  }

  return merged;
}

function reconcileByLidMappings(ownerId: number, botPhone: string | null): number {
  const mappings = db
    .prepare("SELECT lid_jid, phone_jid FROM lid_mappings WHERE owner_id = ?")
    .all(ownerId) as { lid_jid: string; phone_jid: string }[];
  let merged = 0;

  for (const { lid_jid, phone_jid } of mappings) {
    const byLid = getConversationByRemoteJid(ownerId, lid_jid);
    const byPhone = getConversationByRemoteJid(ownerId, phone_jid);
    if (!byLid || !byPhone || byLid.id === byPhone.id) continue;

    const lidRow = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(byLid.id) as ConversationRow;
    const phoneRow = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(byPhone.id) as ConversationRow;
    const { keep, drop } = pickConversationToKeep(lidRow, phoneRow, botPhone);
    mergeConversations(keep.id, drop.id);
    db.prepare("UPDATE conversations SET remote_jid = ? WHERE id = ?").run(phone_jid, keep.id);
    merged += 1;
  }

  return merged;
}

/** Agrupa conversaciones del mismo número, remote_jid o usuario (LID + móvil), dentro de UN owner. */
export function reconcileDuplicateConversations(ownerId: number): number {
  const botPhone = getConnectionState(ownerId).phone;
  return (
    reconcileMisfiledSelfPhone(ownerId, botPhone) +
    reconcileByLidMappings(ownerId, botPhone) +
    reconcileByRemoteJid(ownerId, botPhone) +
    reconcilePhoneFormats(ownerId) +
    reconcileLidDuplicatesByName(ownerId, botPhone)
  );
}

export function restoreConversationRow(row: {
  id: number;
  owner_id: number;
  phone: string;
  remote_jid?: string | null;
  name?: string | null;
  mode?: Mode;
  notes?: string;
  tags?: string | string[];
  context_files?: string | string[];
  last_message_at?: number | null;
  human_takeover_at?: number | null;
  appointment_at?: number | null;
  appointment_status?: AppointmentStatus | null;
  created_at?: number;
}): void {
  const tags = typeof row.tags === "string" ? row.tags : JSON.stringify(row.tags ?? []);
  const contextFiles =
    typeof row.context_files === "string"
      ? row.context_files
      : JSON.stringify(row.context_files ?? []);

  db.prepare(
    `INSERT INTO conversations (id, owner_id, phone, remote_jid, name, mode, notes, tags, context_files, last_message_at, human_takeover_at, appointment_at, appointment_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       owner_id = excluded.owner_id,
       phone = excluded.phone,
       remote_jid = COALESCE(excluded.remote_jid, conversations.remote_jid),
       name = COALESCE(excluded.name, conversations.name),
       mode = excluded.mode,
       notes = excluded.notes,
       tags = excluded.tags,
       context_files = excluded.context_files,
       last_message_at = COALESCE(excluded.last_message_at, conversations.last_message_at),
       human_takeover_at = COALESCE(excluded.human_takeover_at, conversations.human_takeover_at),
       appointment_at = COALESCE(excluded.appointment_at, conversations.appointment_at),
       appointment_status = COALESCE(excluded.appointment_status, conversations.appointment_status),
       created_at = COALESCE(conversations.created_at, excluded.created_at)`
  ).run(
    row.id,
    row.owner_id,
    row.phone,
    row.remote_jid ?? null,
    row.name ?? null,
    row.mode ?? "AI",
    row.notes ?? "",
    tags,
    contextFiles,
    row.last_message_at ?? null,
    row.human_takeover_at ?? null,
    row.appointment_at ?? null,
    row.appointment_status ?? null,
    row.created_at ?? Math.floor(Date.now() / 1000)
  );
}

export function restoreMessageRow(row: {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  created_at?: number;
}): void {
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  ).run(
    row.id,
    row.conversation_id,
    row.role,
    row.content,
    row.created_at ?? Math.floor(Date.now() / 1000)
  );
}

export function bumpSqliteSequences(): void {
  const convMax = db.prepare("SELECT MAX(id) AS max_id FROM conversations").get() as {
    max_id: number | null;
  };
  const msgMax = db.prepare("SELECT MAX(id) AS max_id FROM messages").get() as {
    max_id: number | null;
  };
  if (convMax.max_id != null) {
    db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'conversations'").run(convMax.max_id);
  }
  if (msgMax.max_id != null) {
    db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'messages'").run(msgMax.max_id);
  }
}
