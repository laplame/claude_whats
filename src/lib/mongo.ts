import { MongoClient, type Db } from "mongodb";

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
