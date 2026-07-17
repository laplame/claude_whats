"use client";

import Link from "next/link";
import { useState } from "react";
import { PRICING_PLANS } from "@/lib/site-content";

type Currency = "MXN" | "USD";

function formatPrice(amount: number, currency: Currency): string {
  const formatted = amount.toLocaleString(currency === "MXN" ? "es-MX" : "en-US");
  return currency === "MXN" ? `$${formatted} MXN` : `$${formatted} USD`;
}

export default function PricingPlans() {
  const [currency, setCurrency] = useState<Currency>("MXN");

  return (
    <div>
      <div className="mb-10 flex rounded-xl border border-[#1f3a28]/20 bg-white/70 p-1 sm:w-fit">
        {(["MXN", "USD"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCurrency(option)}
            className={`flex-1 rounded-lg px-5 py-2 text-sm font-semibold transition sm:flex-none ${
              currency === option
                ? "bg-[#1f3a28] text-[#e8efe9]"
                : "text-[#3d5344] hover:text-[#132018]"
            }`}
          >
            {option === "MXN" ? "Pesos (MXN)" : "Dólares (USD)"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-6 transition ${
              plan.highlighted
                ? "border-[#1f3a28] bg-white shadow-lg shadow-[#1f3a28]/10 lg:-translate-y-2"
                : "border-[#1f3a28]/12 bg-white/70 hover:border-[#1f3a28]/25 hover:shadow-lg"
            }`}
          >
            {plan.highlighted ? (
              <span className="mb-3 inline-flex w-fit items-center rounded-full bg-[#1f3a28] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e8efe9]">
                Más elegido
              </span>
            ) : null}

            <h3 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold text-[#132018]">
              {plan.name}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#3d5344]">{plan.tagline}</p>

            <p className="mt-6">
              <span className="font-[family-name:var(--font-landing-display)] text-3xl font-bold text-[#132018]">
                {formatPrice(currency === "MXN" ? plan.priceMxn : plan.priceUsd, currency)}
              </span>
              <span className="text-sm text-[#5f7a66]"> /mes</span>
            </p>

            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-[#3d5344]">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#3d6b47]" aria-hidden>
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={plan.cta.href}
              className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition ${
                plan.highlighted
                  ? "landing-btn-dark shadow-lg shadow-[#1f3a28]/20 hover:shadow-xl"
                  : "border border-[#1f3a28] bg-[#f8fbf8] text-[#132018] shadow-sm hover:bg-white hover:shadow-md"
              }`}
            >
              {plan.cta.label}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-[#5f7a66]">
        Precios de referencia, sujetos a confirmación con un asesor antes de activar. Los planes
        no incluyen procesamiento de pagos automático todavía — al crear tu cuenta coordinamos el
        cobro directamente.
      </p>
    </div>
  );
}
