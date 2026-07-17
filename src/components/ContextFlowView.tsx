"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CONTEXT_HARD_MAX_CHARS,
  CONTEXT_MAX_CHARS,
  CONTEXT_MAX_FILES,
} from "@/lib/context-limits";
import { BIZNEAI } from "@/lib/site-content";

type FlowMode = "lista" | "flowchart";

type ContextFile = {
  filename: string;
  size: number;
  source?: string;
};

type FlowNode = {
  id: string;
  filename: string;
  size: number;
  icon: string;
  label: string;
};

function iconFor(filename: string): { icon: string; label: string } {
  const n = filename.toLowerCase();
  if (n.includes("precio") || n.includes("plan") || n.includes("catalog")) {
    return { icon: "$", label: "Precios" };
  }
  if (n.includes("polit") || n.includes("policy") || n.includes("envio")) {
    return { icon: "P", label: "Políticas" };
  }
  if (n.includes("guion") || n.includes("script") || n.includes("venta")) {
    return { icon: "G", label: "Guion" };
  }
  if (n.includes("faq") || n.includes("pregunta")) {
    return { icon: "?", label: "FAQ" };
  }
  if (n.includes("concat") || n.includes("merge")) {
    return { icon: "Σ", label: "Concat" };
  }
  return { icon: "M", label: "MD" };
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  onOpenFile?: (filename: string) => void;
}

/**
 * Vista para ordenar (drag) y concatenar archivos MD.
 * Nota: iconos arrastrables = flujo de texto MD. No soporta imágenes en el LLM.
 */
export default function ContextFlowView({ onOpenFile }: Props) {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("contexto-completo.md");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FlowMode>("lista");
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpUrl, setMcpUrl] = useState<string>(BIZNEAI.url);

  async function loadFiles() {
    const res = await fetch("/api/context");
    if (!res.ok) return;
    const data = await res.json();
    const list: ContextFile[] = data.files || [];
    setFiles(list);
    setNodes((prev) => {
      if (prev.length === 0) {
        return list.slice(0, CONTEXT_MAX_FILES).map((f) => {
          const meta = iconFor(f.filename);
          return {
            id: f.filename,
            filename: f.filename,
            size: f.size,
            icon: meta.icon,
            label: meta.label,
          };
        });
      }
      const byName = new Map(list.map((f) => [f.filename, f]));
      const kept = prev
        .filter((n) => byName.has(n.filename))
        .map((n) => {
          const f = byName.get(n.filename)!;
          const meta = iconFor(f.filename);
          return { ...n, size: f.size, icon: meta.icon, label: meta.label };
        });
      const existing = new Set(kept.map((n) => n.filename));
      const added = list
        .filter((f) => !existing.has(f.filename))
        .map((f) => {
          const meta = iconFor(f.filename);
          return {
            id: f.filename,
            filename: f.filename,
            size: f.size,
            icon: meta.icon,
            label: meta.label,
          };
        });
      return [...kept, ...added].slice(0, CONTEXT_MAX_FILES);
    });
  }

  useEffect(() => {
    loadFiles();
  }, []);

  const totalBytes = useMemo(
    () => nodes.reduce((acc, n) => acc + (n.size || 0), 0),
    [nodes]
  );

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (overId !== id) setOverId(id);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    setNodes((prev) => {
      const from = prev.findIndex((n) => n.id === dragId);
      const to = prev.findIndex((n) => n.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDragId(null);
    setOverId(null);
  }

  function removeNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }

  function addMissing(filename: string) {
    const f = files.find((x) => x.filename === filename);
    if (!f) return;
    if (nodes.some((n) => n.filename === filename)) return;
    if (nodes.length >= CONTEXT_MAX_FILES) {
      setError(`Máximo recomendado: ${CONTEXT_MAX_FILES} archivos en el flujo.`);
      return;
    }
    const meta = iconFor(f.filename);
    setNodes((prev) => [
      ...prev,
      {
        id: f.filename,
        filename: f.filename,
        size: f.size,
        icon: meta.icon,
        label: meta.label,
      },
    ]);
  }

  async function handleConcat() {
    if (nodes.length === 0) {
      setError("Agregá al menos un archivo al flujo.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/context/concat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filenames: nodes.map((n) => n.filename),
          outputFilename: outputName,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "No se pudo concatenar");
        return;
      }
      setMessage(
        `Guardado: ${data.filename} (${data.chars?.toLocaleString?.() ?? data.chars} caracteres)`
      );
      await loadFiles();
      onOpenFile?.(data.filename);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const unused = files.filter((f) => !nodes.some((n) => n.filename === f.filename));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50">
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Flujo de contexto</h2>
          <div className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setMode("lista")}
              className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${
                mode === "lista"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setMode("flowchart")}
              className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${
                mode === "flowchart"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Flowchart
            </button>
          </div>
        </div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
          {mode === "lista"
            ? "Arrastrá los iconos para ordenar los MD. Al guardar, se concatenan en un solo archivo."
            : "Diagrama del flujo: fuentes (MD + MCP BizneAI) → contexto unificado → IA → WhatsApp + CRM."}{" "}
          <span className="font-medium text-gray-700">
            No soporta imágenes como contexto: solo texto .md y datos del MCP.
          </span>
        </p>
        <p className="mt-2 text-[11px] text-gray-500">
          Recomendado: hasta {CONTEXT_MAX_FILES} archivos · ~{CONTEXT_MAX_CHARS.toLocaleString()}{" "}
          caracteres totales · tope API {CONTEXT_HARD_MAX_CHARS.toLocaleString()} chars
        </p>
      </div>

      {mode === "flowchart" ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <FlowchartCanvas
            nodes={nodes}
            mcpEnabled={mcpEnabled}
            mcpUrl={mcpUrl}
            onToggleMcp={() => setMcpEnabled((v) => !v)}
            onChangeMcpUrl={setMcpUrl}
          />
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Orden del flujo ({nodes.length}) · ~{formatBytes(totalBytes)}
            </p>
            {nodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
                No hay archivos en el flujo. Subí MD en Contexto o agregalos desde
                abajo.
              </div>
            ) : (
              <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                {nodes.map((node, index) => (
                  <li
                    key={node.id}
                    draggable
                    onDragStart={() => onDragStart(node.id)}
                    onDragOver={(e) => onDragOver(e, node.id)}
                    onDrop={() => onDrop(node.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    className={`flex min-w-[140px] flex-1 cursor-grab items-center gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm active:cursor-grabbing ${
                      dragId === node.id ? "opacity-50" : ""
                    } ${
                      overId === node.id
                        ? "border-indigo-400 ring-2 ring-indigo-100"
                        : "border-gray-200"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-800">
                      {node.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {index + 1}. {node.label}
                      </p>
                      <p className="truncate text-xs font-medium text-gray-900">
                        {node.filename}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {formatBytes(node.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNode(node.id)}
                      className="rounded-md px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                      aria-label={`Quitar ${node.filename}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {unused.length > 0 && (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Disponibles (tocá para agregar)
              </p>
              <div className="flex flex-wrap gap-2">
                {unused.map((f) => {
                  const meta = iconFor(f.filename);
                  return (
                    <button
                      key={f.filename}
                      type="button"
                      onClick={() => addMissing(f.filename)}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold">
                        {meta.icon}
                      </span>
                      {f.filename}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block text-xs font-semibold text-gray-700" htmlFor="concat-name">
              Nombre del archivo concatenado
            </label>
            <input
              id="concat-name"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="contexto-completo.md"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || nodes.length === 0}
                onClick={handleConcat}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Concatenar y guardar"}
              </button>
              <button
                type="button"
                onClick={() => loadFiles()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Recargar lista
              </button>
            </div>
            {message && (
              <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>
            )}
            {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
          </section>
        </div>
      </div>
      )}
    </div>
  );
}

interface FlowchartCanvasProps {
  nodes: FlowNode[];
  mcpEnabled: boolean;
  mcpUrl: string;
  onToggleMcp: () => void;
  onChangeMcpUrl: (url: string) => void;
}

type SourceNodeData = {
  filename: string;
  icon: string;
  isMcp?: boolean;
};

type StageTone = "emerald" | "dark" | "brand";

type StageNodeData = {
  icon: string;
  title: string;
  subtitle: string;
  tone: StageTone;
};

type SourceFlowNode = Node<SourceNodeData, "source">;
type StageFlowNode = Node<StageNodeData, "stage">;
type FlowchartNode = SourceFlowNode | StageFlowNode;

function SourceNodeCard({ data }: NodeProps<SourceFlowNode>) {
  return (
    <div
      className={`flex w-[210px] items-center gap-2 rounded-lg border px-2.5 py-2 shadow-sm ${
        data.isMcp ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-white"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
          data.isMcp ? "bg-indigo-600 text-white" : "bg-emerald-50 text-emerald-800"
        }`}
      >
        {data.icon}
      </span>
      <div className="min-w-0">
        <p
          className={`truncate text-xs font-medium ${
            data.isMcp ? "text-indigo-900" : "text-gray-800"
          }`}
        >
          {data.filename}
        </p>
        {data.isMcp ? (
          <p className="truncate text-[10px] text-indigo-500">datos de tu tienda</p>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-gray-400" />
    </div>
  );
}

const STAGE_TONE_CLASSES: Record<
  StageTone,
  { card: string; icon: string; title: string; subtitle: string }
> = {
  emerald: {
    card: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-600 text-white",
    title: "text-emerald-900",
    subtitle: "text-emerald-700",
  },
  dark: {
    card: "border-gray-200 bg-white",
    icon: "bg-gray-900 text-white",
    title: "text-gray-900",
    subtitle: "text-gray-500",
  },
  brand: {
    card: "border-[#1f3a28]/30 bg-white",
    icon: "bg-[#1f3a28] text-white",
    title: "text-gray-900",
    subtitle: "text-gray-500",
  },
};

function StageNodeCard({ data }: NodeProps<StageFlowNode>) {
  const tone = STAGE_TONE_CLASSES[data.tone];
  return (
    <div
      className={`flex w-[180px] flex-col items-center rounded-2xl border p-4 text-center shadow-sm ${tone.card}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-gray-400" />
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${tone.icon}`}>
        {data.icon}
      </span>
      <p className={`mt-2 text-xs font-semibold ${tone.title}`}>{data.title}</p>
      <p className={`mt-1 text-[10px] ${tone.subtitle}`}>{data.subtitle}</p>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-gray-400" />
    </div>
  );
}

const nodeTypes = { source: SourceNodeCard, stage: StageNodeCard };

const SOURCE_X = 20;
const CONTEXT_X = 300;
const IA_X = 560;
const SALIDA_X = 820;
const ROW_HEIGHT = 74;

function buildFlowElements(
  nodes: FlowNode[],
  mcpEnabled: boolean
): { flowNodes: FlowchartNode[]; flowEdges: Edge[] } {
  const sourceIds: string[] = nodes.map((n) => `src-${n.id}`);
  if (mcpEnabled) sourceIds.push("src-mcp");

  const centerY = sourceIds.length > 0 ? ((sourceIds.length - 1) * ROW_HEIGHT) / 2 : 0;

  const sourceNodes: SourceFlowNode[] = nodes.map((n, i) => ({
    id: `src-${n.id}`,
    type: "source",
    position: { x: SOURCE_X, y: i * ROW_HEIGHT },
    data: { filename: n.filename, icon: n.icon },
  }));

  if (mcpEnabled) {
    sourceNodes.push({
      id: "src-mcp",
      type: "source",
      position: { x: SOURCE_X, y: (sourceIds.length - 1) * ROW_HEIGHT },
      data: { filename: `MCP ${BIZNEAI.name}`, icon: "BA", isMcp: true },
    });
  }

  const stageNodes: StageFlowNode[] = [
    {
      id: "contexto",
      type: "stage",
      position: { x: CONTEXT_X, y: centerY },
      data: {
        icon: "Σ",
        title: "Contexto unificado",
        subtitle: mcpEnabled ? "MD concatenados + MCP" : "MD concatenados",
        tone: "emerald",
      },
    },
    {
      id: "ia",
      type: "stage",
      position: { x: IA_X, y: centerY },
      data: { icon: "IA", title: "Motor de IA", subtitle: "responde solo con el contexto", tone: "dark" },
    },
    {
      id: "salida",
      type: "stage",
      position: { x: SALIDA_X, y: centerY },
      data: { icon: "WA", title: "WhatsApp + CRM", subtitle: "atiende, califica y cierra", tone: "brand" },
    },
  ];

  const flowEdges: Edge[] = [
    ...sourceIds.map((id) => ({
      id: `e-${id}-contexto`,
      source: id,
      target: "contexto",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
      style: { stroke: "#9ca3af" },
    })),
    {
      id: "e-contexto-ia",
      source: "contexto",
      target: "ia",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
      style: { stroke: "#9ca3af" },
    },
    {
      id: "e-ia-salida",
      source: "ia",
      target: "salida",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
      style: { stroke: "#9ca3af" },
    },
  ];

  return { flowNodes: [...sourceNodes, ...stageNodes], flowEdges };
}

function FlowchartCanvas({ nodes, mcpEnabled, mcpUrl, onToggleMcp, onChangeMcpUrl }: FlowchartCanvasProps) {
  const { flowNodes: initialNodes, flowEdges: initialEdges } = useMemo(
    () => buildFlowElements(nodes, mcpEnabled),
    [nodes, mcpEnabled]
  );
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<FlowchartNode>(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // El set de nodos/edges se recalcula cuando cambian los archivos o el MCP;
  // el usuario puede seguir arrastrando nodos libremente entre esos cambios.
  useEffect(() => {
    setFlowNodes(initialNodes);
    setFlowEdges(initialEdges);
  }, [initialNodes, initialEdges, setFlowNodes, setFlowEdges]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="h-[520px] overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#e5e7eb" />
          <Controls showInteractive={false} position="bottom-right" />
          <Panel
            position="top-left"
            className="!m-3 w-[220px] rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Fuentes ({nodes.length + (mcpEnabled ? 1 : 0)})
            </p>
            <button
              type="button"
              onClick={onToggleMcp}
              className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                mcpEnabled
                  ? "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {mcpEnabled ? "Quitar MCP BizneAI" : "+ Conectar MCP BizneAI"}
            </button>
            {mcpEnabled && (
              <div className="mt-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Endpoint MCP
                </label>
                <input
                  value={mcpUrl}
                  onChange={(e) => onChangeMcpUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-[11px] outline-none focus:border-indigo-400"
                  placeholder="https://www.bizneai.com/"
                />
              </div>
            )}
          </Panel>
        </ReactFlow>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-relaxed text-indigo-900">
        <p className="font-semibold">Sobre el MCP de {BIZNEAI.name}</p>
        <p className="mt-1 text-indigo-800">
          Conectá el MCP para que el agente use los datos de tu tienda (catálogo,
          precios e inventario) como contexto en vivo, además de tus archivos MD.
          El nodo del diagrama representa esa fuente en el flujo. Arrastrá los
          nodos o usá la rueda para hacer zoom.
        </p>
      </div>
    </div>
  );
}
