import { MongoClient, type Db } from "mongodb";
import { normalizePhone } from "./phone";

// Respaldo opcional de la base SQLite (que sigue siendo la fuente de
// verdad para todas las lecturas del dashboard). Si MONGODB_URI no está
// configurada, todas las funciones de este módulo son no-ops. Si la
// conexión falla, se loguea un warning y el bot sigue funcionando 100%
// con SQLite — nunca se bloquea ni lanza una excepción hacia arriba.

let client: MongoClient | null = null;
let db: Db | null = null;
let connectingPromise: Promise<Db | null> | null = null;
let lastFailureAt = 0;
const RETRY_COOLDOWN_MS = 30_000;

async function getMongoDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (db) return db;
  if (Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) return null;

  if (!connectingPromise) {
    connectingPromise = MongoClient.connect(uri)
      .then((connectedClient) => {
        client = connectedClient;
        db = connectedClient.db(process.env.MONGODB_DB_NAME || "agente_whatsapp");
        console.log("[mongo] conectado a MongoDB Atlas (respaldo activo)");
        return db;
      })
      .catch((err) => {
        lastFailureAt = Date.now();
        console.warn(
          "[mongo] no se pudo conectar a MongoDB Atlas, el bot sigue funcionando 100% con SQLite:",
          err instanceof Error ? err.message : err
        );
        return null;
      })
      .finally(() => {
        connectingPromise = null;
      });
  }

  return connectingPromise;
}

// Los documentos espejados usan el id numérico de SQLite como _id, en vez
// del ObjectId por defecto de Mongo, para que el upsert sea directo por id.
interface MirrorDoc extends Record<string, unknown> {
  _id: number;
}

export function mirrorUpsert(collection: string, id: number, doc: object): void {
  if (!process.env.MONGODB_URI) return;
  const payload = doc as Record<string, unknown>;

  getMongoDb()
    .then((database) => {
      if (!database) return;
      return database
        .collection<MirrorDoc>(collection)
        .updateOne({ _id: id }, { $set: { ...payload, _id: id } }, { upsert: true });
    })
    .catch((err) => {
      console.warn(`[mongo] fallo al replicar en ${collection}#${id}:`, err);
    });
}

export function mirrorDeleteConversation(id: number): void {
  if (!process.env.MONGODB_URI) return;

  getMongoDb()
    .then(async (database) => {
      if (!database) return;
      await database.collection<MirrorDoc>("conversations").deleteOne({ _id: id });
      await database
        .collection<MirrorDoc & { conversation_id: number }>("messages")
        .deleteMany({ conversation_id: id });
    })
    .catch((err) => {
      console.warn(`[mongo] fallo al replicar borrado de conversación #${id}:`, err);
    });
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close().catch(() => {});
    client = null;
    db = null;
  }
}

export async function restoreSqliteFromMongo(): Promise<{
  conversations: number;
  messages: number;
}> {
  if (!process.env.MONGODB_URI) {
    return { conversations: 0, messages: 0 };
  }

  const database = await getMongoDb();
  if (!database) {
    return { conversations: 0, messages: 0 };
  }

  const {
    restoreConversationRow,
    restoreMessageRow,
    bumpSqliteSequences,
    reconcileConversationTimestamps,
  } = await import("./db");

  let conversations = 0;
  let messages = 0;

  const mongoConvos = await database.collection<MirrorDoc>("conversations").find().toArray();
  for (const doc of mongoConvos) {
    const { _id, phone, owner_id, ...rest } = doc as MirrorDoc & {
      phone?: string;
      owner_id?: number;
      remote_jid?: string | null;
      name?: string | null;
      mode?: "AI" | "HUMAN";
      notes?: string;
      tags?: string | string[];
      context_files?: string | string[];
      last_message_at?: number | null;
      human_takeover_at?: number | null;
      appointment_at?: number | null;
      appointment_status?: "AGENDADA" | "CONFIRMADA" | "COMPLETADA" | "NO_SHOW" | "CANCELADA" | null;
      created_at?: number;
    };
    // Docs espejados antes del refactor multi-tenant no tienen owner_id —
    // se omiten en vez de restaurarlos sin dueño (violaría el NOT NULL).
    if (!_id || !phone || !owner_id) continue;
    try {
      restoreConversationRow({
        id: _id,
        owner_id,
        phone: normalizePhone(String(phone)),
        remote_jid: rest.remote_jid ?? null,
        name: rest.name ?? null,
        mode: rest.mode,
        notes: rest.notes,
        tags: rest.tags,
        context_files: rest.context_files,
        last_message_at: rest.last_message_at ?? null,
        human_takeover_at: rest.human_takeover_at ?? null,
        appointment_at: rest.appointment_at ?? null,
        appointment_status: rest.appointment_status ?? null,
        created_at: rest.created_at,
      });
      conversations += 1;
    } catch (err) {
      console.warn(`[mongo] fallo al restaurar conversación #${_id}:`, err);
    }
  }

  const mongoMessages = await database
    .collection<MirrorDoc & { conversation_id: number; role: string; content: string; created_at?: number }>(
      "messages"
    )
    .find()
    .toArray();

  for (const doc of mongoMessages) {
    const { _id, conversation_id, role, content, created_at } = doc;
    if (!_id || !conversation_id || !role || !content) continue;
    if (role !== "user" && role !== "assistant" && role !== "human") continue;
    try {
      restoreMessageRow({
        id: _id,
        conversation_id,
        role,
        content: String(content),
        created_at,
      });
      messages += 1;
    } catch (err) {
      // Mensaje de una conversación que se omitió (ej. sin owner_id en el
      // espejo viejo) — la FK a conversations rechaza el insert. Se salta
      // en vez de abortar toda la restauración por una fila huérfana.
      console.warn(`[mongo] fallo al restaurar mensaje #${_id}:`, err);
    }
  }

  bumpSqliteSequences();
  reconcileConversationTimestamps();

  if (conversations > 0 || messages > 0) {
    console.log(
      `[mongo] restaurado en SQLite: ${conversations} conversaciones, ${messages} mensajes`
    );
  }

  return { conversations, messages };
}
