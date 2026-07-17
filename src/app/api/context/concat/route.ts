import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { includeContextFile } from "@/lib/context-exclusions";
import { contextDirFor, resolveContextFilePath } from "@/lib/bot-context";
import {
  CONTEXT_HARD_MAX_CHARS,
  CONTEXT_HARD_MAX_FILES,
} from "@/lib/context-limits";
import { isUnauthorized, requireUser } from "@/lib/auth-request";

export const runtime = "nodejs";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Concatena varios MD en un archivo nuevo, en el orden indicado.
 * Body: { filenames: string[], outputFilename?: string }
 */
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (isUnauthorized(auth)) return auth;

  const body = await req.json().catch(() => null);
  const filenames = body?.filenames;

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return NextResponse.json({ error: "filenames requerido" }, { status: 400 });
  }
  if (filenames.length > CONTEXT_HARD_MAX_FILES) {
    return NextResponse.json(
      { error: `Máximo ${CONTEXT_HARD_MAX_FILES} archivos por concatenación` },
      { status: 400 }
    );
  }

  const names = filenames
    .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n: string) => n.trim());

  if (names.length === 0) {
    return NextResponse.json({ error: "filenames vacío" }, { status: 400 });
  }

  const blocks: string[] = [];
  for (const name of names) {
    const filePath = resolveContextFilePath(auth.id, name);
    if (!filePath) {
      return NextResponse.json({ error: `No se encontró: ${name}` }, { status: 404 });
    }
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      blocks.push(`=== ${name} ===\n${content.trim()}`);
    } catch {
      return NextResponse.json({ error: `No se pudo leer: ${name}` }, { status: 500 });
    }
  }

  const merged = blocks.join("\n\n");
  if (merged.length > CONTEXT_HARD_MAX_CHARS) {
    return NextResponse.json(
      {
        error: `El resultado supera ${CONTEXT_HARD_MAX_CHARS} caracteres. Reducí archivos o recortá contenido.`,
      },
      { status: 400 }
    );
  }

  const rawOut =
    typeof body?.outputFilename === "string" && body.outputFilename.trim()
      ? body.outputFilename.trim()
      : `concat-${Date.now()}.md`;
  let outputFilename = safeFilename(rawOut);
  if (!outputFilename.endsWith(".md")) outputFilename += ".md";

  const contextDir = contextDirFor(auth.id);
  if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir, { recursive: true });
  const dest = path.join(contextDir, outputFilename);
  fs.writeFileSync(dest, merged, "utf-8");
  includeContextFile(auth.id, outputFilename);

  return NextResponse.json({
    ok: true,
    filename: outputFilename,
    chars: merged.length,
    sources: names,
  });
}
