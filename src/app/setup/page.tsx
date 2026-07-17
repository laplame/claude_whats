"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRScreen from "@/components/QRScreen";
import AuthScreen, { type AuthUser } from "@/components/AuthScreen";

type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export default function SetupPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [qrPng, setQrPng] = useState<string | null>(null);

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
      if (data.status === "connected") {
        router.replace("/app");
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, router]);

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

  return <QRScreen status={status} qrPng={qrPng} variant="setup" />;
}
