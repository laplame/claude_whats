"use client";

import { useState } from "react";

interface DashboardHeaderProps {
  phone: string | null;
  onDisconnected: () => void;
  onLock: () => void;
}

export default function DashboardHeader({ phone, onDisconnected, onLock }: DashboardHeaderProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "¿Desconectar el número de WhatsApp? Vas a tener que escanear el QR de nuevo."
    );
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await fetch("/api/connection/disconnect", { method: "POST" });
      onDisconnected();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <header className="flex flex-col gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="text-xs font-medium text-gray-900">
          {phone ? `+${phone}` : "Conectado"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onLock}
          className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
        >
          Bloquear
        </button>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          {disconnecting ? "Desconectando..." : "Desconectar"}
        </button>
      </div>
    </header>
  );
}
