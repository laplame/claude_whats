import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { mirrorDeleteConversation, mirrorUpsert } from "./mongo";

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

export type Mode = "AI" | "HUMAN";
export type MessageRole = "user" | "assistant" | "human";
export type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: Mode;
  notes: string;
  tags: string[];
  last_message_at: number | null;
  created_at: number;
}

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string | null;
}

interface ConversationRow {
  id: number;
  phone: string;
  name: string | null;
  mode: Mode;
  notes: string;
  tags: string;
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
  return { ...row, tags };
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
  name?: string | null
): Conversation {
  const existing = db
    .prepare("SELECT * FROM conversations WHERE phone = ?")
    .get(phone) as ConversationRow | undefined;

  if (existing) {
    if (name && !existing.name) {
      db.prepare("UPDATE conversations SET name = ? WHERE id = ?").run(
        name,
        existing.id
      );
      existing.name = name;
      const updated = mapConversationRow(existing);
      mirrorUpsert("conversations", updated.id, updated);
      return updated;
    }
    return mapConversationRow(existing);
  }

  const result = db
    .prepare("INSERT INTO conversations (phone, name) VALUES (?, ?)")
    .run(phone, name ?? null);

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
  (conversationId: number, role: MessageRole, content: string) => {
    const result = db
      .prepare(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
      )
      .run(conversationId, role, content);

    db.prepare(
      "UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?"
    ).run(conversationId);

    return result.lastInsertRowid as number;
  }
);

export function insertMessage(
  conversationId: number,
  role: MessageRole,
  content: string
): number {
  const id = insertMessageTxn(conversationId, role, content) as number;

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message;
  mirrorUpsert("messages", id, row);

  const conversation = getConversationById(conversationId);
  if (conversation) {
    mirrorUpsert("conversations", conversation.id, conversation);
  }

  return id;
}

export function getMessages(conversationId: number, limit = 50): Message[] {
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

export function setMode(conversationId: number, mode: Mode): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(
    mode,
    conversationId
  );
  const conversation = getConversationById(conversationId);
  if (conversation) mirrorUpsert("conversations", conversation.id, conversation);
}

export function listConversations(): ConversationWithPreview[] {
  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT content FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_preview
      FROM conversations c
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
    )
    .all() as ConversationRow[];

  return rows.map((row) => ({
    ...mapConversationRow(row),
    last_message_preview: row.last_message_preview ?? null,
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
