"use client";
// apps/web/app/(dashboard)/settings/_components/PaymentsTab.tsx

import { useState } from "react";
import { CreditCard, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "./Switch";
import type { PaymentSettings } from "./types";

// ── Sub-components ────────────────────────────────────────────────────────────

interface DepositCardProps {
  requireDeposit:  boolean;
  onToggle:        (value: boolean) => void;
}

function DepositCard({ requireDeposit, onToggle }: DepositCardProps) {
  return (
    <section
      aria-labelledby="deposit-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="deposit-heading"
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
        Política de Reservas
      </h2>

      <div className="flex items-start justify-between gap-6">
        <div className="space-y-0.5">
          <label
            htmlFor="require-deposit"
            className="cursor-pointer text-sm font-medium text-gray-900"
          >
            Requerir seña obligatoria
          </label>
          <p className="text-xs text-gray-400">
            Los socios deberán abonar una seña al confirmar cada reserva.
          </p>
        </div>

        <Switch
          id="require-deposit"
          checked={requireDeposit}
          onCheckedChange={onToggle}
          aria-label="Requerir seña obligatoria para reservar"
        />
      </div>

      <div
        className={cn(
          "mt-4 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 px-4 py-3",
          "transition-all duration-200",
          requireDeposit ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!requireDeposit}
      >
        <p className="text-xs text-gray-500">
          ✓ Se solicitará el pago de la seña antes de confirmar la reserva.
          El monto se configura desde cada cancha.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface MercadoPagoCardProps {
  token:    string;
  onChange: (token: string) => void;
}

function MercadoPagoCard({ token, onChange }: MercadoPagoCardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <section
      aria-labelledby="mp-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="mp-heading"
        className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <CreditCard className="h-4 w-4 text-accent" aria-hidden="true" />
        Integración MercadoPago
      </h2>
      <p className="mb-5 text-xs text-gray-400">
        Ingresá tu Access Token para procesar pagos y señas. Lo encontrás en{" "}
        <span className="font-medium text-gray-700">
          MercadoPago Developers → Credenciales
        </span>
        .
      </p>

      <div className="space-y-1.5">
        <label
          htmlFor="mp-token"
          className="block text-xs font-medium uppercase tracking-wide text-gray-400"
        >
          Access Token
        </label>

        <div className="relative">
          <input
            id="mp-token"
            type={revealed ? "text" : "password"}
            value={token}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-10",
              "font-mono text-sm text-gray-900 placeholder:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition",
            )}
            placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxx"
          />

          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Ocultar token" : "Mostrar token"}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
          >
            {revealed
              ? <EyeOff className="h-4 w-4" aria-hidden="true" />
              : <Eye    className="h-4 w-4" aria-hidden="true" />
            }
          </button>
        </div>

        {token && !revealed && (
          <p className="text-xs text-gray-400">
            El token está guardado de forma segura. Hacé clic en el ojo para verlo.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Public tab ────────────────────────────────────────────────────────────────

interface PaymentsTabProps {
  data:     PaymentSettings;
  onChange: (data: PaymentSettings) => void;
}

export function PaymentsTab({ data, onChange }: PaymentsTabProps) {
  const update = <K extends keyof PaymentSettings>(field: K, value: PaymentSettings[K]) =>
    onChange({ ...data, [field]: value });

  return (
    <div
      id="panel-payments"
      role="tabpanel"
      aria-labelledby="tab-payments"
      className="space-y-4"
    >
      <DepositCard
        requireDeposit={data.requireDeposit}
        onToggle={(v) => update("requireDeposit", v)}
      />
      <MercadoPagoCard
        token={data.mercadopagoToken}
        onChange={(v) => update("mercadopagoToken", v)}
      />
    </div>
  );
}
