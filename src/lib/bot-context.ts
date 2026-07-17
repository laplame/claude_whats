import fs from "node:fs";
import path from "node:path";
import { filterExcludedContextFiles } from "./context-exclusions";
import { isBotContextFile } from "./context-files";
import { getContextFiles } from "./db";

const PROJECT_ROOT = path.resolve(process.cwd());
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

/** Contexto subido por cada cuenta vive en su propia carpeta. */
export function contextDirFor(ownerId: number): string {
  return path.resolve(process.cwd(), "data", "context", String(ownerId));
}

function isSafeSegment(segment: string): boolean {
  if (!segment || segment === "." || segment === "..") return false;
  if (segment.includes("\\")) return false;
  if (segment.length > 255) return false;
  return true;
}

/** Rechaza `..`, rutas absolutas y separadores raros antes de tocar el filesystem. */
function isSafeRelativePath(filename: string): boolean {
  if (!filename) return false;
  const normalized = filename.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return false;
  return normalized.split("/").every(isSafeSegment);
}

function listMdInDir(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMdInDir(full, path.join(prefix, entry.name)));
      continue;
    }
    if (entry.name.toLowerCase().endsWith(".md") && isBotContextFile(entry.name)) {
      out.push(path.join(prefix, entry.name).replace(/\\/g, "/"));
    }
  }
  return out;
}

/** Archivos .md de contexto disponibles para un owner (subidos + del proyecto, sin README). */
export function listDefinedContextFilenames(ownerId: number): string[] {
  const files: string[] = [];
  const contextDir = contextDirFor(ownerId);

  if (fs.existsSync(contextDir)) {
    for (const name of fs.readdirSync(contextDir)) {
      if (name.toLowerCase().endsWith(".md") && isBotContextFile(name)) {
        files.push(name);
      }
    }
  }

  for (const entry of fs.readdirSync(PROJECT_ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md") && isBotContextFile(entry.name)) {
      files.push(entry.name);
    }
  }

  files.push(...listMdInDir(DOCS_DIR, "docs"));

  const unique = [...new Set(files)];
  return filterExcludedContextFiles(ownerId, unique.map((filename) => ({ filename }))).map(
    (f) => f.filename
  );
}

export function resolveContextFilePath(ownerId: number, filename: string): string | null {
  if (!isSafeRelativePath(filename)) return null;

  const candidates = [
    path.join(contextDirFor(ownerId), filename),
    path.join(PROJECT_ROOT, filename),
    path.join(PROJECT_ROOT, "docs", filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function loadContextBodies(
  ownerId: number,
  filenames: string[]
): { filename: string; content: string }[] {
  const loaded: { filename: string; content: string }[] = [];
  for (const filename of filenames) {
    const filePath = resolveContextFilePath(ownerId, filename);
    if (!filePath) continue;
    try {
      loaded.push({ filename, content: fs.readFileSync(filePath, "utf-8") });
    } catch {
      // omitir archivos ilegibles
    }
  }
  return loaded;
}

export function getActiveContextFilenames(ownerId: number, conversationId?: number): string[] {
  const attached = conversationId ? getContextFiles(conversationId) : [];
  if (attached.length > 0) return attached;
  return listDefinedContextFilenames(ownerId);
}

export function buildContextSystemPrompt(ownerId: number, conversationId?: number): string | undefined {
  const filenames = getActiveContextFilenames(ownerId, conversationId);
  const bodies = loadContextBodies(ownerId, filenames);
  if (bodies.length === 0) return undefined;

  return bodies.map(({ filename, content }) => `=== ${filename} ===\n${content}`).join("\n\n");
}

export function hasDefinedBotContext(ownerId: number, conversationId?: number): boolean {
  return Boolean(buildContextSystemPrompt(ownerId, conversationId));
}
