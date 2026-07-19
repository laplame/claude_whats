/**
 * Reset limpio para volver a conectar WhatsApp desde cero.
 *
 * Borra:
 *  - todas las sesiones del dashboard (cookies de login)
 *  - estado de conexión WA (QR / teléfono)
 *  - carpetas auth/{ownerId}/ de Baileys (sesión WhatsApp)
 *
 * NO borra conversaciones, mensajes, CRM ni archivos de contexto.
 *
 * Uso en el VPS:
 *   cd ~/claude_whats
 *   npx pm2 stop whats-claude-bot whats-claude-web
 *   npx tsx scripts/reset-whatsapp-session.ts
 *   # opcional, forzar passcode admin:
 *   npx tsx scripts/reset-admin-passcode.ts saul.laplame@gmail.com 8044
 *   npx pm2 restart whats-claude-bot whats-claude-web
 *
 * Luego: login → /setup → escanear QR nuevo.
 */
import fs from "node:fs";
import path from "node:path";
import "./env-loader";
import { db } from "../src/lib/db";

const root = process.cwd();
const authRoot = path.resolve(root, "auth");

function tableExists(name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

console.log("=== Reset WhatsApp + sesiones dashboard ===\n");

// 1) Sesiones web
if (tableExists("dashboard_sessions")) {
  const before = (
    db.prepare("SELECT COUNT(*) AS c FROM dashboard_sessions").get() as { c: number }
  ).c;
  db.prepare("DELETE FROM dashboard_sessions").run();
  console.log(`✓ Sesiones dashboard borradas (${before})`);
} else {
  console.log("· Sin tabla dashboard_sessions");
}

// 2) Estado de conexión
if (tableExists("connection_state")) {
  const rows = db
    .prepare("SELECT owner_id, status, phone FROM connection_state")
    .all() as { owner_id: number; status: string; phone: string | null }[];

  for (const row of rows) {
    console.log(
      `  owner ${row.owner_id}: ${row.status}${row.phone ? ` (+${row.phone})` : ""} → disconnected`
    );
  }

  db.prepare(
    `UPDATE connection_state
     SET status = 'disconnected', qr_string = NULL, phone = NULL, updated_at = unixepoch()`
  ).run();
  console.log("✓ connection_state reseteado");
} else {
  console.log("· Sin tabla connection_state");
}

// 3) Comandos pendientes de conexión
if (tableExists("connection_commands")) {
  db.prepare("DELETE FROM connection_commands").run();
  console.log("✓ cola connection_commands vaciada");
}

// 4) Auth Baileys en disco
if (fs.existsSync(authRoot)) {
  const entries = fs.readdirSync(authRoot, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    const full = path.join(authRoot, entry.name);
    // legacy single-tenant files or per-owner dirs
    fs.rmSync(full, { recursive: true, force: true });
    removed += 1;
    console.log(`  borrado auth/${entry.name}`);
  }
  console.log(`✓ carpeta auth/ limpia (${removed} entradas)`);
} else {
  console.log("· No hay carpeta auth/ (ok)");
}

// Flag legacy por si quedó
const restartFlag = path.resolve(root, "data", ".restart");
if (fs.existsSync(restartFlag)) {
  fs.rmSync(restartFlag, { force: true });
  console.log("✓ data/.restart eliminado");
}

console.log(`
Listo. Próximos pasos:
  1) npx pm2 restart whats-claude-bot whats-claude-web
  2) Login en /app (email + passcode)
  3) Ir a /setup y escanear el QR nuevo con WhatsApp
`);
