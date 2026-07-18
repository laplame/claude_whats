/**
 * Resetea el passcode del admin (AUTH_ADMIN_EMAIL) al valor de AUTH_ADMIN_PASSCODE.
 *
 * Uso en el VPS:
 *   cd ~/claude_whats
 *   npx tsx scripts/reset-admin-passcode.ts
 *
 * Opcional: forzar email/passcode por CLI
 *   npx tsx scripts/reset-admin-passcode.ts saul.laplame@gmail.com 8044
 */
import "./env-loader";
import {
  createDashboardUser,
  findDashboardUserForLogin,
  listDashboardUsers,
  updateDashboardUserPasscode,
} from "../src/lib/auth";
import { normalizePhone } from "../src/lib/phone";

const emailArg = process.argv[2]?.trim();
const passcodeArg = process.argv[3]?.trim();

const email = (emailArg || process.env.AUTH_ADMIN_EMAIL || "").trim().toLowerCase();
const passcode = (passcodeArg || process.env.AUTH_ADMIN_PASSCODE || "").trim();
const whatsapp = (process.env.AUTH_ADMIN_WHATSAPP || "").trim();
const name = (process.env.AUTH_ADMIN_NAME || "Admin").trim();

if (!email || !email.includes("@")) {
  console.error("Falta AUTH_ADMIN_EMAIL (o pasalo como 1er argumento).");
  process.exit(1);
}
if (!passcode || passcode.length < 4) {
  console.error("Falta AUTH_ADMIN_PASSCODE (o pasalo como 2º argumento, mín. 4 chars).");
  process.exit(1);
}

console.log("Usuarios actuales:");
for (const u of listDashboardUsers()) {
  console.log(`  #${u.id}  ${u.email}  wa=${u.whatsapp}  name=${u.name ?? "-"}`);
}

const existing = findDashboardUserForLogin(email);
if (existing) {
  const updated = updateDashboardUserPasscode(email, passcode);
  console.log(`\nPasscode actualizado para ${updated.email} (id=${updated.id}).`);
  console.log("Sesiones anteriores invalidadas. Probá login con ese email + el passcode nuevo.");
} else {
  if (!whatsapp || normalizePhone(whatsapp).length < 10) {
    console.error(
      `No existe ${email} y falta AUTH_ADMIN_WHATSAPP válido para crearlo.`
    );
    process.exit(1);
  }
  const created = createDashboardUser({ email, whatsapp, passcode, name });
  console.log(`\nUsuario creado: ${created.email} (id=${created.id}).`);
}

console.log(`\nLogin: ${email} / ${passcode}`);
