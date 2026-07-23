// Este módulo solo tiene side effects (poblar process.env). Debe ser el
// PRIMER import de start-bot.ts: los `import` de ES modules se hoistean
// al inicio del archivo, así que si openrouter.ts lee process.env en su
// top-level, necesita que esto ya haya corrido antes de ser importado.
import fs from "node:fs";
import path from "node:path";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  const text = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function applyEnv(vars: Record<string, string>, { override }: { override: boolean }) {
  for (const [key, value] of Object.entries(vars)) {
    const current = process.env[key];
    const isEmpty = current == null || current.trim() === "";
    if (override || isEmpty) {
      // No pisar una key real del entorno con un valor vacío del archivo.
      if (value.trim() === "" && !isEmpty) continue;
      process.env[key] = value;
    }
  }
}

const root = process.cwd();
const envPath = path.resolve(root, ".env");
const localPath = path.resolve(root, ".env.local");

// .env primero, .env.local encima (como Next.js).
applyEnv(parseEnvFile(envPath), { override: false });
applyEnv(parseEnvFile(localPath), { override: true });
