"use client";

import Link from "next/link";
import { useState } from "react";

type DashboardView = "chats" | "crm" | "flujo" | "agenda" | "stats";

interface DashboardHeaderProps {
  phone: string | null;
  userLabel?: string | null;
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  onDisconnected: () => void;
  onLock: () => void;
}

const TABS: { id: DashboardView; label: string }[] = [
  { id: "chats", label: "Chats" },
  { id: "crm", label: "CRM" },
  { id: "flujo", label: "Flujo" },
  { id: "agenda", label: "Agenda" },
  { id: "stats", label: "Stats" },
];

export default function DashboardHeader({
  phone,
  userLabel,
  view,
  onViewChange,
  onDisconnected,
  onLock,
}: DashboardHeaderProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "¿Desconectar el número de WhatsApp? Vas a tener que escanear el QR de nuevo."
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setMenuOpen(false);
    try {
      await fetch("/api/connection/disconnect", { method: "POST" });
      onDisconnected();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            className="shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Volver al inicio"
            title="Volver al inicio"
          >
            ← Inicio
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate text-xs font-medium text-gray-900">
                {phone ? `+${phone}` : "Conectado"}
              </span>
            </div>
            {userLabel ? (
              <p className="mt-0.5 truncate text-[10px] text-gray-500">{userLabel}</p>
            ) : null}
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
            aria-expanded={menuOpen}
            aria-label="Más opciones"
          >
            ···
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLock();
                  }}
                  className="block w-full px-3 py-2.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="block w-full px-3 py-2.5 text-left text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnecting ? "Desconectando..." : "Desconectar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <nav
        className="mt-2 flex w-full flex-wrap gap-1 rounded-md border border-gray-200 bg-gray-50 p-1"
        aria-label="Vistas del dashboard"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onViewChange(tab.id)}
            className={`min-w-[4.5rem] flex-1 rounded px-2.5 py-1.5 text-[11px] font-semibold ${
              view === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
