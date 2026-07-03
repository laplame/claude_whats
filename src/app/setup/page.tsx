"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRScreen from "@/components/QRScreen";

type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      const res = await fetch("/api/connection/status");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setStatus(data.status);
      setQrPng(data.qrPng);
      setStatusLoaded(true);
      if (data.status === "connected") {
        router.replace("/");
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return <QRScreen status={status} qrPng={qrPng} variant="setup" />;
}
