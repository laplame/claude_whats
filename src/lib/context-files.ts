import path from "node:path";

/** Markdown de documentación del repo, no contexto del agente. */
const EXCLUDED_BASENAMES = new Set(["readme.md"]);

export function isBotContextFile(filename: string): boolean {
  const base = path.basename(filename.replace(/\\/g, "/"));
  return !EXCLUDED_BASENAMES.has(base.toLowerCase());
}

export function filterBotContextFiles(filenames: string[]): string[] {
  return filenames.filter(isBotContextFile);
}
