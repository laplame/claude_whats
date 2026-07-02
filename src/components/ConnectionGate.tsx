"use client";

import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import ConversationList, { type ConversationListItem } from "./ConversationList";
import ConversationPanel from "./ConversationPanel";

type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export default function ConnectionGate() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      const res = await fetch("/api/connection/status");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setStatus(data.status);
      setQrPng(data.qrPng);
      setPhone(data.phone);
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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

  function handleDeleted() {
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  }

  function handleDisconnected() {
    setStatus("disconnected");
    setQrPng(null);
    setPhone(null);
    setConversations([]);
    setSelectedId(null);
  }

  if (status !== "connected") {
    return <QRScreen status={status} qrPng={qrPng} />;
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader phone={phone} onDisconnected={handleDisconnected} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="flex-1 overflow-hidden">
          {selected ? (
            <ConversationPanel
              conversation={selected}
              onDeleted={handleDeleted}
              onModeChanged={handleModeChanged}
              onCrmUpdated={handleCrmUpdated}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Seleccioná una conversación para ver los mensajes
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
