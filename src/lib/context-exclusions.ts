import fs from "node:fs";
import path from "node:path";

const EXCLUSIONS_FILE = path.resolve(process.cwd(), "data", "context-exclusions.json");

function readExclusions(): string[] {
  try {
    if (!fs.existsSync(EXCLUSIONS_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(EXCLUSIONS_FILE, "utf-8"));
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeExclusions(files: string[]): void {
  fs.mkdirSync(path.dirname(EXCLUSIONS_FILE), { recursive: true });
  fs.writeFileSync(EXCLUSIONS_FILE, JSON.stringify([...new Set(files)], null, 2));
}

export function isContextExcluded(filename: string): boolean {
  return readExclusions().includes(filename);
}

export function excludeContextFile(filename: string): void {
  const current = readExclusions();
  if (!current.includes(filename)) {
    writeExclusions([...current, filename]);
  }
}

export function includeContextFile(filename: string): void {
  writeExclusions(readExclusions().filter((f) => f !== filename));
}

export function filterExcludedContextFiles<T extends { filename: string }>(files: T[]): T[] {
  const excluded = new Set(readExclusions());
  return files.filter((f) => !excluded.has(f.filename));
}
