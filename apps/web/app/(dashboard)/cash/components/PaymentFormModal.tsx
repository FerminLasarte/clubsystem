// apps/web/app/(dashboard)/cash/components/PaymentFormModal.tsx
// Modal para registrar un nuevo cobro en la caja diaria.

import { useState } from "react";
import { X, DollarSign } from "lucide-react";
import type { PaymentCreate, MemberOut } from "@/lib/api";

const PAYMENT_METHODS = [
  { value: "EFECTIVO",      label: "Efectivo" },
  { value: "TARJETA",       label: "Tarjeta" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "MERCADOPAGO",   label: "MercadoPago" },
];

interface Props {
  open:     boolean;
  onClose:  () => void;
  onSubmit: (payload: PaymentCreate) => Promise<void>;
  members:  MemberOut[];
  saving:   boolean;
}

export function PaymentFormModal({ open, onClose, onSubmit, members, saving }: Props) {
  const [amount,      setAmount]      = useState("");
  const [method,      setMethod]      = useState("EFECTIVO");
  const [description, setDescription] = useState("");
  const [memberId,    setMemberId]    = useState<string>("");

  if (!open) return null;

  const isValid = Number(amount) > 0 && description.trim().length > 0 && method;

  function handleClose() {
    if (saving) return;
    setAmount("");
    setMethod("EFECTIVO");
    setDescription("");
    setMemberId("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || saving) return;

    await onSubmit({
      amount:         Number(amount),
      payment_method: method,
      description:    description.trim(),
      member_id:      memberId || null,
    });

    // Reset
    setAmount("");
    setMethod("EFECTIVO");
    setDescription("");
    setMemberId("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Registrar cobro</h2>
          <button
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Monto */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Monto <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <DollarSign className="h-4 w-4" />
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Método <span className="text-red-400">*</span>
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Descripción <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Pago turno Cancha 1"
              required
              maxLength={255}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Socio (opcional) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Socio <span className="text-gray-300">(opcional)</span>
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— Sin socio asociado —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                  {m.member_number ? ` (#${m.member_number})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando…" : "Registrar cobro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
