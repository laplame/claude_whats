import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function moveFlatFilesIntoOwnerDir(flatDir: string, ownerDir: string, filter?: (name: string) => boolean): void {
  if (!fs.existsSync(flatDir)) return;
  if (fs.existsSync(ownerDir)) return;

  const entries = fs
    .readdirSync(flatDir, { withFileTypes: true })
    .filter((e) => e.isFile() && (!filter || filter(e.name)));
  if (entries.length === 0) return;

  fs.mkdirSync(ownerDir, { recursive: true });
  for (const entry of entries) {
    fs.renameSync(path.join(flatDir, entry.name), path.join(ownerDir, entry.name));
  }
}

/** Mueve `auth/*.json` (sesión de WhatsApp pre-multi-tenant) a `auth/{ownerId}/`. */
export function migrateLegacyAuthDir(ownerId: number): void {
  const flatAuthDir = path.join(ROOT, "auth");
  if (!fs.existsSync(path.join(flatAuthDir, "creds.json"))) return;
  moveFlatFilesIntoOwnerDir(flatAuthDir, path.join(flatAuthDir, String(ownerId)), (name) =>
    name.toLowerCase().endsWith(".json")
  );
}

/** Mueve `data/context/*.md` (contexto pre-multi-tenant) a `data/context/{ownerId}/`. */
export function migrateLegacyContextDir(ownerId: number): void {
  const flatContextDir = path.join(ROOT, "data", "context");
  moveFlatFilesIntoOwnerDir(flatContextDir, path.join(flatContextDir, String(ownerId)), (name) =>
    name.toLowerCase().endsWith(".md")
  );
}

/** Mueve `data/context-exclusions.json` a `data/context-exclusions/{ownerId}.json`. */
export function migrateLegacyExclusions(ownerId: number): void {
  const flatFile = path.join(ROOT, "data", "context-exclusions.json");
  const newDir = path.join(ROOT, "data", "context-exclusions");
  const newFile = path.join(newDir, `${ownerId}.json`);
  if (!fs.existsSync(flatFile) || fs.existsSync(newFile)) return;
  fs.mkdirSync(newDir, { recursive: true });
  fs.renameSync(flatFile, newFile);
}
