"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "./DashboardHeader";
import ConversationList, { type ConversationListItem } from "./ConversationList";
import ContextManager from "./ContextManager";
import ConversationPanel from "./ConversationPanel";
import MarkdownEditor from "./MarkdownEditor";
import CrmBoard from "./CrmBoard";
import ContextFlowView from "./ContextFlowView";
import AgendaView from "./AgendaView";
import AuthScreen, { type AuthUser } from "./AuthScreen";
import { dashboardRoleLabel } from "@/lib/roles";

type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export default function ConnectionGate() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedContextFile, setSelectedContextFile] = useState<string | null>(null);
  const [view, setView] = useState<"chats" | "crm" | "flujo" | "agenda">("chats");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (!cancelled) {
            setUser(null);
            setAuthChecked(true);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUser(data.user ?? null);
          setAuthChecked(true);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setAuthChecked(true);
        }
      }
    }
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function fetchStatus() {
      const res = await fetch("/api/connection/status");
      if (res.status === 401) {
        if (!cancelled) setUser(null);
        return;
      }
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
  }, [user]);

  useEffect(() => {
    if (!user || !statusLoaded || status === "connected") return;
    router.replace("/setup");
  }, [user, statusLoaded, status, router]);

  useEffect(() => {
    if (!user || status !== "connected") return;
    let cancelled = false;

    async function fetchConversations() {
      const res = await fetch("/api/conversations");
      if (res.status === 401) {
        if (!cancelled) setUser(null);
        return;
      }
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const sorted = [...(data.conversations || [])].sort(
        (a: ConversationListItem, b: ConversationListItem) =>
          (b.last_message_at ?? 0) - (a.last_message_at ?? 0) || b.id - a.id
      );
      setConversations(sorted);
    }

    fetchConversations();
    const interval = setInterval(fetchConversations, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, status]);

  function handleModeChanged(id: number, mode: "AI" | "HUMAN") {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, mode } : c)));
  }

  function handleCrmUpdated(
    id: number,
    patch: Partial<
      Pick<ConversationListItem, "notes" | "tags" | "appointment_at" | "appointment_status">
    >
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

  function handleConversationMerged(droppedId: number) {
    setConversations((prev) => prev.filter((c) => c.id !== droppedId));
    if (selectedId === droppedId) {
      setSelectedId(null);
      setSelectedContextFile(null);
    }
  }

  function handleSelectedConversation(id: number) {
    setSelectedId(id);
    setSelectedContextFile(null);
    setView("chats");
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

  async function handleLock() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setStatusLoaded(false);
    setConversations([]);
    setSelectedId(null);
    setSelectedContextFile(null);
  }

  if (!authChecked) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLoggedIn={(nextUser) => setUser(nextUser)} />;
  }

  if (!statusLoaded || status !== "connected") {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const showingDetail = Boolean(selected || selectedContextFile);
  const sidebarContent = (
    <>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelectedConversation}
          onDelete={handleDeleteConversation}
        />
      </div>
      <div className="shrink-0 border-t border-gray-200 bg-gray-50">
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
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <DashboardHeader
        phone={phone}
        userLabel={
          dashboardRoleLabel(user.role)
            ? `${user.name || user.email} · ${dashboardRoleLabel(user.role)}`
            : user.name || user.email
        }
        view={view}
        onViewChange={(nextView) => {
          setView(nextView);
          if (nextView === "crm" || nextView === "flujo" || nextView === "agenda") {
            setSelectedContextFile(null);
            setSelectedId(null);
          }
        }}
        onDisconnected={handleDisconnected}
        onLock={handleLock}
      />
      {view === "crm" ? (
        <main className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <CrmBoard
            conversations={conversations}
            onSelect={handleSelectedConversation}
            onDelete={handleDeleteConversation}
            onCrmUpdated={handleCrmUpdated}
          />
        </main>
      ) : view === "flujo" ? (
        <main className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <ContextFlowView
            onOpenFile={(filename) => {
              setSelectedContextFile(filename);
              setView("chats");
            }}
          />
        </main>
      ) : view === "agenda" ? (
        <main className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <AgendaView
            conversations={conversations}
            onSelect={handleSelectedConversation}
            onCrmUpdated={handleCrmUpdated}
          />
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden md:flex-row">
          <aside
            className={`flex w-full shrink-0 flex-col overflow-hidden border-gray-200 bg-white transition-[width] duration-200 md:border-r ${
              sidebarCollapsed ? "md:w-12" : "md:w-80"
            } ${
              showingDetail ? "hidden md:flex" : "flex"
            }`}
          >
            {sidebarCollapsed ? (
              <>
                <div className="hidden h-full flex-col items-center gap-3 py-3 md:flex">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(false)}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                    aria-label="Expandir columna de chats"
                    title="Expandir chats"
                  >
                    →
                  </button>
                  <div className="flex flex-1 items-center justify-center">
                    <span className="rotate-90 whitespace-nowrap text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                      Chats
                    </span>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-500">
                    {conversations.length}
                  </span>
                </div>
                <div className="flex h-full flex-col md:hidden">{sidebarContent}</div>
              </>
            ) : (
              <>
                <div className="hidden items-center justify-between border-b border-gray-100 px-3 py-2 md:flex">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                    Panel
                  </span>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                    aria-label="Colapsar columna de chats"
                    title="Colapsar chats"
                  >
                    ← Colapsar
                  </button>
                </div>
                {sidebarContent}
              </>
            )}
          </aside>
          <main
            className={`min-h-0 flex-1 overflow-hidden ${
              showingDetail ? "flex" : "hidden md:flex"
            }`}
          >
            {selectedContextFile ? (
              <MarkdownEditor
                filename={selectedContextFile}
                onClose={() => setSelectedContextFile(null)}
              />
            ) : selected ? (
              <ConversationPanel
                key={selected.id}
                conversation={selected}
                onBack={() => {
                  setSelectedId(null);
                  setSelectedContextFile(null);
                }}
                onDelete={handleDeleteConversation}
                onModeChanged={handleModeChanged}
                onCrmUpdated={handleCrmUpdated}
                onMerged={handleConversationMerged}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                Seleccioná una conversación o un archivo MD para verlo aquí.
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
