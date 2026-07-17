import fs from "node:fs";
import path from "node:path";

function exclusionsFileFor(ownerId: number): string {
  return path.resolve(process.cwd(), "data", "context-exclusions", `${ownerId}.json`);
}

function readExclusions(ownerId: number): string[] {
  try {
    const file = exclusionsFileFor(ownerId);
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeExclusions(ownerId: number, files: string[]): void {
  const file = exclusionsFileFor(ownerId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify([...new Set(files)], null, 2));
}

export function isContextExcluded(ownerId: number, filename: string): boolean {
  return readExclusions(ownerId).includes(filename);
}

export function excludeContextFile(ownerId: number, filename: string): void {
  const current = readExclusions(ownerId);
  if (!current.includes(filename)) {
    writeExclusions(ownerId, [...current, filename]);
  }
}

export function includeContextFile(ownerId: number, filename: string): void {
  writeExclusions(ownerId, readExclusions(ownerId).filter((f) => f !== filename));
}

export function filterExcludedContextFiles<T extends { filename: string }>(
  ownerId: number,
  files: T[]
): T[] {
  const excluded = new Set(readExclusions(ownerId));
  return files.filter((f) => !excluded.has(f.filename));
}
