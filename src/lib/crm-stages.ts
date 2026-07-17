export type CrmStage = "LEAD" | "MKTQL" | "SALES" | "CLOSED" | "SALES-AGAIN";

export const CRM_STAGES: { id: CrmStage; label: string; badgeClass: string }[] = [
  { id: "LEAD", label: "LEAD", badgeClass: "bg-blue-50 text-blue-700" },
  { id: "MKTQL", label: "MKTQL", badgeClass: "bg-emerald-50 text-emerald-700" },
  { id: "SALES", label: "SALES", badgeClass: "bg-violet-50 text-violet-700" },
  { id: "CLOSED", label: "CLOSED", badgeClass: "bg-rose-50 text-rose-700" },
  { id: "SALES-AGAIN", label: "SALES-AGAIN", badgeClass: "bg-slate-100 text-slate-700" },
];

export const CRM_STAGE_IDS = CRM_STAGES.map((stage) => stage.id);

export function getConversationStageFromTags(tags: string[]): CrmStage {
  const tag = tags.find((t) => CRM_STAGE_IDS.includes(t.toUpperCase() as CrmStage));
  return (tag?.toUpperCase() as CrmStage | undefined) ?? "LEAD";
}

/** Reemplaza el tag de etapa (si había uno) preservando el resto de los tags. */
export function withStage(tags: string[], stage: CrmStage): string[] {
  return [stage, ...tags.filter((t) => !CRM_STAGE_IDS.includes(t.toUpperCase() as CrmStage))];
}

/**
 * Frases en español que indican intención FUERTE de compra (no solo interés
 * o una pregunta de precio). Simple matching por substring, sin LLM: rápido,
 * gratis y predecible a costa de no captar frases indirectas o con errores
 * de tipeo raros.
 */
export const BUYING_INTENT_KEYWORDS = [
  "quiero comprar",
  "quiero pagar",
  "cómo pago",
  "como pago",
  "cómo compro",
  "como compro",
  "quiero contratar",
  "quiero activar",
  "quiero adquirir",
  "lo quiero",
  "lo compro",
  "me lo llevo",
  "dónde pago",
  "donde pago",
  "hago la transferencia",
  "te transfiero",
  "confirmo el pedido",
  "confirmo mi pedido",
  "quiero hacer el pedido",
  "quiero ordenar",
  "cierro la compra",
  "quiero cerrar la compra",
];

export function hasBuyingIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return BUYING_INTENT_KEYWORDS.some((kw) => normalized.includes(kw));
}

/** Solo se escala hacia adelante desde estas etapas: nunca baja de etapa ni reabre CLOSED/SALES-AGAIN. */
const ESCALATABLE_STAGES: CrmStage[] = ["LEAD", "MKTQL"];

/** Devuelve los tags con la etapa en SALES, o null si no corresponde escalar. */
export function escalateStageForBuyingIntent(currentTags: string[]): string[] | null {
  const stage = getConversationStageFromTags(currentTags);
  if (!ESCALATABLE_STAGES.includes(stage)) return null;
  return withStage(currentTags, "SALES");
}
