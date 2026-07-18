"use client";

import { useMemo, useState } from "react";
import type { ConversationListItem } from "./ConversationList";
import { getConversationStageFromTags, type CrmStage } from "@/lib/crm-stages";

const FUNNEL_STAGES: CrmStage[] = ["LEAD", "MKTQL", "SALES", "CLOSED"];
const ALL_STAGES: CrmStage[] = [...FUNNEL_STAGES, "SALES-AGAIN"];

// Ordinal blue ramp (funnel stages), validated:
// node scripts/validate_palette.js "#86b6ef,#5598e7,#256abf,#104281" --ordinal --mode light → ALL CHECKS PASS
// SALES-AGAIN uses categorical slot 2 (green): it's a parallel/repeat state, not
// "further along" than CLOSED, so it intentionally breaks the ordinal ramp.
const STAGE_COLOR: Record<CrmStage, string> = {
  LEAD: "#86b6ef",
  MKTQL: "#5598e7",
  SALES: "#256abf",
  CLOSED: "#104281",
  "SALES-AGAIN": "#008300",
};

const STAGE_LABEL: Record<CrmStage, string> = {
  LEAD: "Lead",
  MKTQL: "MKTQL",
  SALES: "Sales",
  CLOSED: "Closed",
  "SALES-AGAIN": "Sales again",
};

function formatPct(n: number, total: number): string {
  if (total === 0) return "—";
  return `${((n / total) * 100).toFixed(1)}%`;
}

interface StatsViewProps {
  conversations: ConversationListItem[];
}

export default function StatsView({ conversations }: StatsViewProps) {
  const [tableView, setTableView] = useState(false);

  const { counts, total, maxCount } = useMemo(() => {
    const c: Record<CrmStage, number> = {
      LEAD: 0,
      MKTQL: 0,
      SALES: 0,
      CLOSED: 0,
      "SALES-AGAIN": 0,
    };
    for (const conversation of conversations) {
      c[getConversationStageFromTags(conversation.tags)] += 1;
    }
    const max = Math.max(1, ...ALL_STAGES.map((stage) => c[stage]));
    return { counts: c, total: conversations.length, maxCount: max };
  }, [conversations]);

  const closedTotal = counts.CLOSED + counts["SALES-AGAIN"];
  const closeRate = total > 0 ? (closedTotal / total) * 100 : 0;

  const kpis = [
    { label: "Leads totales", value: total.toLocaleString("es-MX") },
    { label: "Tasa de cierre", value: total > 0 ? `${closeRate.toFixed(1)}%` : "—" },
    { label: "Cerrados", value: counts.CLOSED.toLocaleString("es-MX") },
    { label: "Recompra", value: counts["SALES-AGAIN"].toLocaleString("es-MX") },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-lg font-bold text-slate-800 sm:text-xl">Stats</h1>
          <p className="mt-1 text-xs text-slate-500">
            Distribución actual de leads por etapa de CRM.
          </p>
        </div>

        {total === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Todavía no hay leads para calcular estadísticas.
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-800">Distribución por etapa</h2>
                <button
                  type="button"
                  onClick={() => setTableView((v) => !v)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  {tableView ? "Ver gráfico" : "Ver tabla"}
                </button>
              </div>

              {tableView ? (
                <table className="mt-4 w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="pb-2 font-medium">Etapa</th>
                      <th className="pb-2 font-medium">Leads</th>
                      <th className="pb-2 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_STAGES.map((stage) => (
                      <tr key={stage} className="border-t border-slate-100">
                        <td className="py-2 font-medium text-slate-700">{STAGE_LABEL[stage]}</td>
                        <td className="py-2 tabular-nums text-slate-700">{counts[stage]}</td>
                        <td className="py-2 tabular-nums text-slate-500">
                          {formatPct(counts[stage], total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="mt-5 space-y-3">
                  {ALL_STAGES.map((stage) => {
                    const count = counts[stage];
                    const widthPct = count > 0 ? Math.max((count / maxCount) * 100, 4) : 0;
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {STAGE_LABEL[stage]}
                        </span>
                        <div className="h-6 flex-1 rounded-md bg-slate-100">
                          <div
                            className="h-6 rounded-r-[4px] transition-all"
                            style={{ width: `${widthPct}%`, backgroundColor: STAGE_COLOR[stage] }}
                            title={`${STAGE_LABEL[stage]}: ${count} (${formatPct(count, total)})`}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600">
                          {count} · {formatPct(count, total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
                Instantánea del estado actual: no es un embudo histórico, no
                registramos cuándo cambió cada lead de etapa.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
