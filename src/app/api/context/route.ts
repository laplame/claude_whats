import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { isBotContextFile } from "@/lib/context-files";
import { filterExcludedContextFiles } from "@/lib/context-exclusions";
import { contextDirFor } from "@/lib/bot-context";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

const PROJECT_ROOT = path.resolve(process.cwd());
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

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
    if (name.toLowerCase().endsWith(".md") && isBotContextFile(name)) {
      const st = fs.statSync(full);
      out.push({ filename: path.join(prefix, name).replace(/\\/g, "/"), added_at: Math.floor(st.mtimeMs / 1000), size: st.size, source: "project" });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const files: { filename: string; added_at: number; size: number; source: string }[] = [];

  // archivos de contexto subidos por esta cuenta
  const contextDir = contextDirFor(auth.id);
  if (fs.existsSync(contextDir)) {
    const uploaded = fs.readdirSync(contextDir).filter((f) => f.toLowerCase().endsWith(".md"));
    for (const fn of uploaded) {
      const full = path.join(contextDir, fn);
      const st = fs.statSync(full);
      files.push({ filename: fn, added_at: Math.floor(st.mtimeMs / 1000), size: st.size, source: "uploaded" });
    }
  }

  // markdowns del proyecto (raíz y docs/), compartidos entre todas las cuentas
  const rootEntries = fs
    .readdirSync(PROJECT_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md") && isBotContextFile(e.name));
  for (const e of rootEntries) {
    const full = path.join(PROJECT_ROOT, e.name);
    const st = fs.statSync(full);
    files.push({ filename: e.name, added_at: Math.floor(st.mtimeMs / 1000), size: st.size, source: "project" });
  }

  if (fs.existsSync(DOCS_DIR)) {
    files.push(...listMdInDir(DOCS_DIR, "docs"));
  }

  return NextResponse.json({ files: filterExcludedContextFiles(auth.id, files) });
}
