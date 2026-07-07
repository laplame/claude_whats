import fs from "node:fs";
import path from "node:path";
import { filterExcludedContextFiles } from "./context-exclusions";
import { isBotContextFile } from "./context-files";
import { getContextFiles } from "./db";

const CONTEXT_DIR = path.resolve(process.cwd(), "data", "context");
const PROJECT_ROOT = path.resolve(process.cwd());
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

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

/** Archivos .md de contexto disponibles en el proyecto (sin README). */
export function listDefinedContextFilenames(): string[] {
  const files: string[] = [];

  if (fs.existsSync(CONTEXT_DIR)) {
    for (const name of fs.readdirSync(CONTEXT_DIR)) {
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
  return filterExcludedContextFiles(unique.map((filename) => ({ filename }))).map((f) => f.filename);
}

export function resolveContextFilePath(filename: string): string | null {
  const candidates = [
    path.join(CONTEXT_DIR, filename),
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

export function loadContextBodies(filenames: string[]): { filename: string; content: string }[] {
  const loaded: { filename: string; content: string }[] = [];
  for (const filename of filenames) {
    const filePath = resolveContextFilePath(filename);
    if (!filePath) continue;
    try {
      loaded.push({ filename, content: fs.readFileSync(filePath, "utf-8") });
    } catch {
      // omitir archivos ilegibles
    }
  }
  return loaded;
}

export function getActiveContextFilenames(conversationId?: number): string[] {
  const attached = conversationId ? getContextFiles(conversationId) : [];
  if (attached.length > 0) return attached;
  return listDefinedContextFilenames();
}

export function buildContextSystemPrompt(conversationId?: number): string | undefined {
  const filenames = getActiveContextFilenames(conversationId);
  const bodies = loadContextBodies(filenames);
  if (bodies.length === 0) return undefined;

  return bodies.map(({ filename, content }) => `=== ${filename} ===\n${content}`).join("\n\n");
}

export function hasDefinedBotContext(conversationId?: number): boolean {
  return Boolean(buildContextSystemPrompt(conversationId));
}
