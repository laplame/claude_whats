"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "./DashboardHeader";
import ConversationList, { type ConversationListItem } from "./ConversationList";
import ContextManager from "./ContextManager";
import ConversationPanel from "./ConversationPanel";
import MarkdownEditor from "./MarkdownEditor";

type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

const DEPLOY_PASSCODE = "8044";
const PASSCODE_STORAGE_KEY = "whats-claude-deploy-passcode-authorized";
const IS_DEV = process.env.NODE_ENV === "development";

export default function ConnectionGate() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(IS_DEV);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedContextFile, setSelectedContextFile] = useState<string | null>(null);

  useEffect(() => {
    if (IS_DEV) {
      setAuthorized(true);
      return;
    }
    const stored = window.localStorage.getItem(PASSCODE_STORAGE_KEY);
    if (stored === "true") {
      setAuthorized(true);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    async function fetchStatus() {
      const res = await fetch("/api/connection/status");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setStatus(data.status);
      setQrPng(data.qrPng);
      setPhone(data.phone);
      setStatusLoaded(true);
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authorized]);

  useEffect(() => {
    if (!authorized || !statusLoaded || status === "connected") return;
    router.replace("/setup");
  }, [authorized, statusLoaded, status, router]);

  useEffect(() => {
    if (status !== "connected") return;
    let cancelled = false;

    async function fetchConversations() {
      const res = await fetch("/api/conversations");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setConversations(data.conversations);
    }

    fetchConversations();
    const interval = setInterval(fetchConversations, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  function handleModeChanged(id: number, mode: "AI" | "HUMAN") {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, mode } : c)));
  }

  function handleCrmUpdated(
    id: number,
    patch: Partial<Pick<ConversationListItem, "notes" | "tags">>
  ) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleDeleteConversation(id: number) {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        console.error("Error borrando conversación:", res.status, res.statusText);
        return;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedContextFile(null);
      }
    } catch (err) {
      console.error("Falla de red borrando conversación:", err);
    }
  }

  function handleSelectedConversation(id: number) {
    setSelectedId(id);
    setSelectedContextFile(null);
  }

  function handleSelectedContextFile(filename: string) {
    setSelectedContextFile(filename);
    setSelectedId(null);
  }

  function handleDisconnected() {
    setStatus("disconnected");
    setQrPng(null);
    setPhone(null);
    setConversations([]);
    setSelectedId(null);
    setSelectedContextFile(null);
    router.replace("/setup");
  }

  function handleLock() {
    window.localStorage.removeItem(PASSCODE_STORAGE_KEY);
    setAuthorized(false);
  }

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900/95 p-8 shadow-xl shadow-slate-950/40">
          <h1 className="mb-4 text-2xl font-semibold">Acceso restringido</h1>
          <p className="mb-6 text-sm text-slate-400">
            Ingresá el código de acceso para ver el dashboard.
          </p>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="deploy-passcode">
            Código de acceso
          </label>
          <input
            id="deploy-passcode"
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none transition focus:border-slate-500"
            placeholder="Código"
          />
          {passcodeError ? (
            <p className="mt-3 text-sm text-rose-400">{passcodeError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (passcode === DEPLOY_PASSCODE) {
                window.localStorage.setItem(PASSCODE_STORAGE_KEY, "true");
                setAuthorized(true);
                setPasscodeError(null);
              } else {
                setPasscodeError("Passcode incorrecto. Intentá de nuevo.");
              }
            }}
            className="mt-6 w-full rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600"
          >
            Desbloquear dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!statusLoaded || status !== "connected") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader phone={phone} onDisconnected={handleDisconnected} onLock={handleLock} />
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-80 shrink-0 flex h-full flex-col overflow-hidden border-b border-gray-200 bg-white md:border-b-0 md:border-r">
          <div className="flex-1 overflow-y-auto md:max-h-full">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={handleSelectedConversation}
              onDelete={handleDeleteConversation}
            />
          </div>
          <div className="border-t border-gray-200 bg-gray-50">
            <ContextManager
              selectedConversationId={selectedId}
              selectedFile={selectedContextFile}
              onSelectFile={handleSelectedContextFile}
              onDeleteFile={(filename) => {
                if (selectedContextFile === filename) {
                  setSelectedContextFile(null);
                }
              }}
            />
          </div>
        </aside>
        <main className="flex-1 overflow-hidden">
          {selectedContextFile ? (
            <MarkdownEditor
              filename={selectedContextFile}
              onClose={() => setSelectedContextFile(null)}
            />
          ) : selected ? (
            <ConversationPanel
              conversation={selected}
              onDelete={handleDeleteConversation}
              onModeChanged={handleModeChanged}
              onCrmUpdated={handleCrmUpdated}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Seleccioná una conversación o un archivo MD para verlo aquí.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
