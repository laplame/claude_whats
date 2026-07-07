import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { mirrorDeleteConversation, mirrorUpsert } from "./mongo";
import { filterBotContextFiles } from "./context-files";
import { normalizePhone, phoneLookupVariants, isLikelyLidPhone } from "./phone";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "messages.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  last_message_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
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
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
    NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(sent, created_at);
`);

// Migración best-effort para bases creadas antes de agregar notes/tags
// (CREATE TABLE IF NOT EXISTS no altera tablas ya existentes).
const existingColumns = new Set(
  (db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[]).map(
    (c) => c.name
  )
);
if (!existingColumns.has("notes")) {
  db.exec("ALTER TABLE conversations ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
}
if (!existingColumns.has("tags")) {
  db.exec("ALTER TABLE conversations ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
}
  if (!existingColumns.has("context_files")) {
    db.exec("ALTER TABLE conversations ADD COLUMN context_files TEXT NOT NULL DEFAULT '[]'");
  }
if (!existingColumns.has("remote_jid")) {
  db.exec("ALTER TABLE conversations ADD COLUMN remote_jid TEXT");
}

export type Mode = "AI" | "HUMAN";
export type MessageRole = "user" | "assistant" | "human";
export type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export interface Conversation {
  id: number;
  phone: string;
  remote_jid: string | null;
  name: string | null;
  mode: Mode;
  notes: string;
  tags: string[];
  context_files: string[];
  last_message_at: number | null;
  created_at: number;
}

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string | null;
}

interface ConversationRow {
  id: number;
  phone: string;
  remote_jid?: string | null;
  name: string | null;
  mode: Mode;
  notes: string;
  tags: string;
  context_files?: string;
  last_message_at: number | null;
  created_at: number;
  last_message_preview?: string | null;
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
  return { ...row, tags, context_files: filterBotContextFiles(context_files), remote_jid: row.remote_jid ?? null };
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

export function detachContextFileFromAll(filename: string): void {
  const rows = db
    .prepare("SELECT id, context_files FROM conversations")
    .all() as { id: number; context_files: string }[];

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
  id: number;
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
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

export function getOrCreateConversation(
  phone: string,
  name?: string | null,
  remoteJid?: string | null
): Conversation {
  const canonical = normalizePhone(phone);
  const variants = phoneLookupVariants(phone);
  const placeholders = variants.map(() => "?").join(", ");
  const existing = db
    .prepare(`SELECT * FROM conversations WHERE phone IN (${placeholders}) LIMIT 1`)
    .get(...variants) as ConversationRow | undefined;

  if (existing) {
    let changed = false;
    if (existing.phone !== canonical) {
      existing.phone = canonical;
      changed = true;
    }
    if (name && !existing.name) {
      existing.name = name;
      changed = true;
    }
    if (remoteJid && existing.remote_jid !== remoteJid) {
      existing.remote_jid = remoteJid;
      changed = true;
    }
    if (changed) {
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
    return mapConversationRow(existing);
  }

  const result = db
    .prepare("INSERT INTO conversations (phone, name, remote_jid) VALUES (?, ?, ?)")
    .run(canonical, name ?? null, remoteJid ?? null);

  const created = getConversationById(result.lastInsertRowid as number)!;
  mirrorUpsert("conversations", created.id, created);
  return created;
}

export function getConversationById(id: number): Conversation | null {
  const row = db
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as ConversationRow | undefined;
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

export function setMode(conversationId: number, mode: Mode): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(
    mode,
    conversationId
  );
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
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

export function listConversations(): ConversationWithPreview[] {
  reconcileDuplicateConversations();
  reconcileConversationTimestamps();

  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT content FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_preview,
        COALESCE(
          (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
          c.last_message_at,
          c.created_at
        ) AS sort_at
      FROM conversations c
      ORDER BY sort_at DESC, c.id DESC`
    )
    .all() as (ConversationRow & { sort_at?: number })[];

  return rows.map((row) => ({
    ...mapConversationRow(row),
    last_message_preview: row.last_message_preview ?? null,
    last_message_at: row.sort_at ?? row.last_message_at,
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

export function getConnectionState(): ConnectionState {
  return db
    .prepare("SELECT * FROM connection_state WHERE id = 1")
    .get() as ConnectionState;
}

export function setConnectionState(update: ConnectionStateUpdate): void {
  const current = getConnectionState();
  const next = {
    status: "status" in update && update.status !== undefined
      ? update.status
      : current.status,
    qr_string: "qr_string" in update ? update.qr_string ?? null : current.qr_string,
    phone: "phone" in update ? update.phone ?? null : current.phone,
  };

  db.prepare(
    "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1"
  ).run(next.status, next.qr_string, next.phone);
}

export function enqueueOutbox(
  conversationId: number,
  phone: string,
  content: string
): number {
  const result = db
    .prepare(
      "INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)"
    )
    .run(conversationId, phone, content);
  return result.lastInsertRowid as number;
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return db
    .prepare("SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT ?")
    .all(limit) as OutboxItem[];
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

export function getConversationByPhone(phone: string): Conversation | null {
  const variants = phoneLookupVariants(phone);
  const placeholders = variants.map(() => "?").join(", ");
  const row = db
    .prepare(`SELECT * FROM conversations WHERE phone IN (${placeholders}) LIMIT 1`)
    .get(...variants) as ConversationRow | undefined;
  return row ? mapConversationRow(row) : null;
}

const mergeConversationsTxn = db.transaction((keepId: number, dropId: number) => {
  const keep = getConversationById(keepId);
  const drop = getConversationById(dropId);

  if (keep && drop) {
    const context_files = [...new Set([...keep.context_files, ...drop.context_files])];
    const tags = [...new Set([...keep.tags, ...drop.tags])];
    const notes = keep.notes || drop.notes;
    const remote_jid = keep.remote_jid || drop.remote_jid;
    const name = keep.name || drop.name;
    db.prepare(
      "UPDATE conversations SET context_files = ?, tags = ?, notes = ?, remote_jid = ?, name = ? WHERE id = ?"
    ).run(JSON.stringify(context_files), JSON.stringify(tags), notes, remote_jid, name, keepId);
  }

  db.prepare("UPDATE messages SET conversation_id = ? WHERE conversation_id = ?").run(keepId, dropId);
  db.prepare("UPDATE outbox SET conversation_id = ? WHERE conversation_id = ?").run(keepId, dropId);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(dropId);
});

export function mergeConversations(keepId: number, dropId: number): void {
  if (keepId === dropId) return;
  mergeConversationsTxn(keepId, dropId);
  mirrorDeleteConversation(dropId);
  reconcileConversationTimestamps();
  const kept = getConversationById(keepId);
  if (kept) mirrorUpsert("conversations", kept.id, kept);
}

export function reconcilePhoneFormats(): number {
  const rows = db.prepare("SELECT * FROM conversations").all() as ConversationRow[];
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

    mergeConversations(keepId, row.id);
    merged += 1;
  }

  return merged;
}

function reconcileLidDuplicatesByName(): number {
  const rows = db.prepare("SELECT * FROM conversations").all() as ConversationRow[];
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

    const real = group.find((row) => !isLikelyLidPhone(row.phone));
    if (!real) continue;

    for (const row of group) {
      if (row.id === real.id || !isLikelyLidPhone(row.phone)) continue;
      if (!getConversationById(row.id)) continue;
      mergeConversations(real.id, row.id);
      merged += 1;
    }
  }

  return merged;
}

/** Agrupa conversaciones del mismo número o del mismo usuario (LID + móvil). */
export function reconcileDuplicateConversations(): number {
  return reconcilePhoneFormats() + reconcileLidDuplicatesByName();
}

export function restoreConversationRow(row: {
  id: number;
  phone: string;
  remote_jid?: string | null;
  name?: string | null;
  mode?: Mode;
  notes?: string;
  tags?: string | string[];
  context_files?: string | string[];
  last_message_at?: number | null;
  created_at?: number;
}): void {
  const tags = typeof row.tags === "string" ? row.tags : JSON.stringify(row.tags ?? []);
  const contextFiles =
    typeof row.context_files === "string"
      ? row.context_files
      : JSON.stringify(row.context_files ?? []);

  db.prepare(
    `INSERT INTO conversations (id, phone, remote_jid, name, mode, notes, tags, context_files, last_message_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       phone = excluded.phone,
       remote_jid = COALESCE(excluded.remote_jid, conversations.remote_jid),
       name = COALESCE(excluded.name, conversations.name),
       mode = excluded.mode,
       notes = excluded.notes,
       tags = excluded.tags,
       context_files = excluded.context_files,
       last_message_at = COALESCE(excluded.last_message_at, conversations.last_message_at),
       created_at = COALESCE(conversations.created_at, excluded.created_at)`
  ).run(
    row.id,
    row.phone,
    row.remote_jid ?? null,
    row.name ?? null,
    row.mode ?? "AI",
    row.notes ?? "",
    tags,
    contextFiles,
    row.last_message_at ?? null,
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
