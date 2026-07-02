"use client";

import { useState } from "react";

interface DashboardHeaderProps {
  phone: string | null;
  onDisconnected: () => void;
}

export default function DashboardHeader({ phone, onDisconnected }: DashboardHeaderProps) {
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
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="text-sm font-medium text-gray-900">
          {phone ? `Conectado como +${phone}` : "Conectado"}
        </span>
      </div>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={disconnecting}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        {disconnecting ? "Desconectando..." : "Desconectar"}
      </button>
    </header>
  );
}
