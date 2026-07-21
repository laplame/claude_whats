import crypto from "node:crypto";
import { db } from "./db";
import { normalizePhone, phonesMatch } from "./phone";
import { hashPasscode, verifyPasscode } from "./passcode";
import { isDashboardRole, type DashboardRole } from "./roles";
import { ensureDefaultCloserContext } from "./bot-context";

const SESSION_COOKIE = "dashboard_session";
const SESSION_DAYS = 30;

export { SESSION_COOKIE, hashPasscode, verifyPasscode };

export interface DashboardUser {
  id: number;
  email: string;
  whatsapp: string;
  name: string | null;
  role: DashboardRole | null;
  created_at: number;
}

interface UserRow {
  id: number;
  email: string;
  whatsapp: string;
  name: string | null;
  role: string | null;
  passcode_hash: string;
  created_at: number;
}

// Las tablas dashboard_users/dashboard_sessions se crean en db.ts (no acá),
// para que cualquier entrypoint que importe db.ts directamente (como
// scripts/start-bot.ts, que nunca importa este archivo) las tenga garantizadas.

function mapUser(row: UserRow): DashboardUser {
  return {
    id: row.id,
    email: row.email,
    whatsapp: row.whatsapp,
    name: row.name,
    role: isDashboardRole(row.role) ? row.role : null,
    created_at: row.created_at,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function countDashboardUsers(): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM dashboard_users").get() as { c: number };
  return row.c;
}

export function createDashboardUser(input: {
  email: string;
  whatsapp: string;
  passcode: string;
  name?: string | null;
  role?: string | null;
}): DashboardUser {
  const email = normalizeEmail(input.email);
  const whatsapp = normalizePhone(input.whatsapp);
  if (!email.includes("@")) throw new Error("email inválido");
  if (!whatsapp || whatsapp.length < 10) throw new Error("whatsapp inválido");
  if (!input.passcode || input.passcode.length < 4) {
    throw new Error("el passcode debe tener al menos 4 caracteres");
  }
  if (input.role != null && !isDashboardRole(input.role)) {
    throw new Error("rol inválido");
  }

  const existingEmail = db
    .prepare("SELECT id FROM dashboard_users WHERE email = ? COLLATE NOCASE")
    .get(email) as { id: number } | undefined;
  if (existingEmail) throw new Error("ese email ya está registrado");

  const existingPhone = (db.prepare("SELECT * FROM dashboard_users").all() as UserRow[]).find(
    (row) => phonesMatch(row.whatsapp, whatsapp)
  );
  if (existingPhone) throw new Error("ese WhatsApp ya está registrado");

  const result = db
    .prepare(
      "INSERT INTO dashboard_users (email, whatsapp, name, role, passcode_hash) VALUES (?, ?, ?, ?, ?)"
    )
    .run(email, whatsapp, input.name?.trim() || null, input.role ?? null, hashPasscode(input.passcode));

  const user = getDashboardUserById(result.lastInsertRowid as number)!;
  ensureDefaultCloserContext(user.id);
  return user;
}

export function getDashboardUserById(id: number): DashboardUser | null {
  const row = db
    .prepare("SELECT * FROM dashboard_users WHERE id = ?")
    .get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function findDashboardUserForLogin(identifier: string): UserRow | null {
  const raw = identifier.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    return (
      (db
        .prepare("SELECT * FROM dashboard_users WHERE email = ? COLLATE NOCASE")
        .get(normalizeEmail(raw)) as UserRow | undefined) ?? null
    );
  }

  const phone = normalizePhone(raw);
  const rows = db.prepare("SELECT * FROM dashboard_users").all() as UserRow[];
  return rows.find((row) => phonesMatch(row.whatsapp, phone)) ?? null;
}

/** Actualiza el passcode de un usuario existente (por email). */
export function updateDashboardUserPasscode(email: string, passcode: string): DashboardUser {
  if (!passcode || passcode.length < 4) {
    throw new Error("el passcode debe tener al menos 4 caracteres");
  }
  const normalized = normalizeEmail(email);
  const row = db
    .prepare("SELECT * FROM dashboard_users WHERE email = ? COLLATE NOCASE")
    .get(normalized) as UserRow | undefined;
  if (!row) throw new Error(`no existe usuario con email ${normalized}`);

  db.prepare("UPDATE dashboard_users SET passcode_hash = ? WHERE id = ?").run(
    hashPasscode(passcode),
    row.id
  );
  // Invalida sesiones previas para forzar re-login
  db.prepare("DELETE FROM dashboard_sessions WHERE user_id = ?").run(row.id);

  return getDashboardUserById(row.id)!;
}

export function listDashboardUsers(): DashboardUser[] {
  const rows = db.prepare("SELECT * FROM dashboard_users ORDER BY id ASC").all() as UserRow[];
  return rows.map(mapUser);
}

export function createSession(userId: number): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  db.prepare(
    "INSERT INTO dashboard_sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function deleteSession(token: string): void {
  db.prepare("DELETE FROM dashboard_sessions WHERE token = ?").run(token);
}

export function deleteExpiredSessions(): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM dashboard_sessions WHERE expires_at < ?").run(now);
}

export function getUserBySessionToken(token: string | undefined | null): DashboardUser | null {
  if (!token) return null;
  deleteExpiredSessions();
  const row = db
    .prepare(
      `SELECT u.*
       FROM dashboard_sessions s
       INNER JOIN dashboard_users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at >= ?`
    )
    .get(token, Math.floor(Date.now() / 1000)) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

/** Crea el usuario admin inicial desde env si la tabla está vacía. */
export function ensureSeedAdminUser(): DashboardUser | null {
  if (countDashboardUsers() > 0) return null;

  const email = process.env.AUTH_ADMIN_EMAIL?.trim() || "admin@local";
  const whatsapp = process.env.AUTH_ADMIN_WHATSAPP?.trim() || "5210000000000";
  const passcode = process.env.AUTH_ADMIN_PASSCODE?.trim() || "8044";
  const name = process.env.AUTH_ADMIN_NAME?.trim() || "Admin";

  return createDashboardUser({ email, whatsapp, passcode, name });
}

// Seed al cargar el módulo.
try {
  ensureSeedAdminUser();
} catch {
  // si falla el seed (p.ej. datos inválidos), el login mostrará el error
}
