"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DASHBOARD_ROLES } from "@/lib/roles";

export interface AuthUser {
  id: number;
  email: string;
  whatsapp: string;
  name: string | null;
  role: string | null;
}

interface AuthScreenProps {
  onLoggedIn: (user: AuthUser) => void;
}

type AuthMode = "signin" | "signup";

const inputClass =
  "mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none transition focus:border-slate-500";

const passwordInputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-3 pr-16 text-white outline-none transition focus:border-slate-500";

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={passwordInputClass}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label={visible ? "Ocultar passcode" : "Mostrar passcode"}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
    </div>
  );
}

export default function AuthScreen({ onLoggedIn }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>(DASHBOARD_ROLES[0].value);
  const [passcode, setPasscode] = useState("");
  const [passcodeConfirm, setPasscodeConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setPasscode("");
    setPasscodeConfirm("");
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, passcode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "No se pudo iniciar sesión");
        return;
      }
      onLoggedIn(data.user);
    } catch {
      setError("Error de red al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    if (passcode !== passcodeConfirm) {
      setError("Los passcodes no coinciden");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, whatsapp, passcode, name: name.trim() || null, role }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "No se pudo crear la cuenta");
        return;
      }
      onLoggedIn(data.user);
    } catch {
      setError("Error de red al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="font-semibold tracking-tight text-white transition hover:text-emerald-400"
        >
          WhatsClaude
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          <span aria-hidden>←</span> Volver al inicio
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900/95 p-8 shadow-xl shadow-slate-950/40">
        <div className="mb-6 flex rounded-xl border border-slate-700 bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "signin" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "signup" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign up
          </button>
        </div>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn}>
            <h1 className="mb-2 text-2xl font-semibold">Iniciar sesión</h1>
            <p className="mb-6 text-sm text-slate-400">
              Usá tu email o WhatsApp y el passcode de tu cuenta.
            </p>

            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="auth-identifier">
              Email o WhatsApp
            </label>
            <input
              id="auth-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className={inputClass}
              placeholder="vos@email.com o 52155..."
              required
            />

            <PasswordField
              id="auth-passcode"
              label="Passcode"
              value={passcode}
              onChange={setPasscode}
              placeholder="Passcode"
              autoComplete="current-password"
              required
            />

            {error ? <p className="mb-2 text-sm text-rose-400">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp}>
            <h1 className="mb-2 text-2xl font-semibold">Crear cuenta</h1>
            <p className="mb-6 text-sm text-slate-400">
              Registrá email, WhatsApp y un passcode para acceder al dashboard.
            </p>

            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="signup-name">
              Nombre (opcional)
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Tu nombre"
            />

            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="signup-role">
              Tu rol en el negocio
            </label>
            <select
              id="signup-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={inputClass}
            >
              {DASHBOARD_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="vos@email.com"
              required
            />

            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="signup-whatsapp">
              WhatsApp
            </label>
            <input
              id="signup-whatsapp"
              type="tel"
              autoComplete="tel"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              className={inputClass}
              placeholder="52155..."
              required
            />

            <PasswordField
              id="signup-passcode"
              label="Passcode"
              value={passcode}
              onChange={setPasscode}
              placeholder="Mínimo 4 caracteres"
              autoComplete="new-password"
              minLength={4}
              required
            />

            <PasswordField
              id="signup-passcode-confirm"
              label="Confirmar passcode"
              value={passcodeConfirm}
              onChange={setPasscodeConfirm}
              placeholder="Repetí el passcode"
              autoComplete="new-password"
              minLength={4}
              required
            />

            {error ? <p className="mb-2 text-sm text-rose-400">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "Creando cuenta..." : "Sign up"}
            </button>
          </form>
        )}
        </div>
      </main>

      <footer className="border-t border-slate-800 px-4 py-6 text-xs text-slate-500 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-slate-300">WhatsClaude</span>
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/" className="transition hover:text-slate-300">
              Inicio
            </Link>
            <Link href="/faq" className="transition hover:text-slate-300">
              FAQ
            </Link>
            <Link href="/contacto" className="transition hover:text-slate-300">
              Contacto
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
