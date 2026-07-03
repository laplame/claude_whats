import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const CONTEXT_DIR = path.resolve(process.cwd(), "data", "context");
const PROJECT_ROOT = path.resolve(process.cwd());
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

function statIfExists(p: string) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function listMdInDir(dir: string, prefix = "") {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: { filename: string; added_at: number; size: number; source: string }[] = [];
  for (const e of entries) {
    const name = e.name;
    const full = path.join(dir, name);
    if (e.isDirectory()) {
      out.push(...listMdInDir(full, path.join(prefix, name)));
      continue;
    }
    if (name.toLowerCase().endsWith(".md")) {
      const st = fs.statSync(full);
      out.push({ filename: path.join(prefix, name).replace(/\\/g, "/"), added_at: Math.floor(st.mtimeMs / 1000), size: st.size, source: "project" });
    }
  }
  return out;
}

export async function GET() {
  const files: { filename: string; added_at: number; size: number; source: string }[] = [];

  // uploaded context files
  if (fs.existsSync(CONTEXT_DIR)) {
    const uploaded = fs.readdirSync(CONTEXT_DIR).filter((f) => f.toLowerCase().endsWith(".md"));
    for (const fn of uploaded) {
      const full = path.join(CONTEXT_DIR, fn);
      const st = fs.statSync(full);
      files.push({ filename: fn, added_at: Math.floor(st.mtimeMs / 1000), size: st.size, source: "uploaded" });
    }
  }

  // project-root markdowns (top-level and inside docs/)
  const rootEntries = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true }).filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"));
  for (const e of rootEntries) {
    const full = path.join(PROJECT_ROOT, e.name);
    const st = fs.statSync(full);
    files.push({ filename: e.name, added_at: Math.floor(st.mtimeMs / 1000), size: st.size, source: "project" });
  }

  // docs directory (recursive)
  if (fs.existsSync(DOCS_DIR)) {
    files.push(...listMdInDir(DOCS_DIR, "docs"));
  }

  return NextResponse.json({ files });
}
