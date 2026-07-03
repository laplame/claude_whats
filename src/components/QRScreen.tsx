"use client";

import { useEffect, useState } from "react";

interface QRScreenProps {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qrPng: string | null;
  variant?: "default" | "setup";
}

export default function QRScreen({ status, qrPng, variant = "default" }: QRScreenProps) {
  const [secondsInDisconnected, setSecondsInDisconnected] = useState(0);

  useEffect(() => {
    if (status !== "disconnected") {
      setSecondsInDisconnected(0);
      return;
    }
    const interval = setInterval(() => {
      setSecondsInDisconnected((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const showError = status === "disconnected" && !qrPng && secondsInDisconnected > 10;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-gray-50 px-4 text-center">
      {variant === "setup" && (
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Setup inicial</p>
      )}
      <h1 className="text-xl font-semibold text-gray-900">Conectar número de WhatsApp</h1>
      {variant === "setup" && (
        <p className="-mt-4 max-w-md text-sm text-gray-500">
          Escaneá el QR desde tu teléfono para vincular WhatsApp y empezar a usar el agente.
        </p>
      )}

      {status === "qr" && qrPng && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrPng}
            alt="Código QR de WhatsApp"
            className="h-[min(320px,70vw)] w-[min(320px,70vw)] rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          />
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Esperando escaneo... Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo.
          </div>
        </>
      )}

      {status === "connecting" && !qrPng && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Conectando...
        </div>
      )}

      {status === "disconnected" && !showError && (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      )}

      {showError && (
        <p className="max-w-sm text-sm text-red-600">
          No se pudo generar el QR. Verificá que el proceso del bot (
          <code className="rounded bg-red-50 px-1">npm run start:bot</code>) esté corriendo y
          reiniciá si es necesario.
        </p>
      )}
    </div>
  );
}
