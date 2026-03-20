// apps/web/app/(dashboard)/cash/components/PaymentsTable.tsx
// Tabla de cobros del día con hora, descripción, método, importe y soft-delete.

import { Receipt, Trash2 } from "lucide-react";
import type { PaymentOut } from "@/lib/api";

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO:      "Efectivo",
  TARJETA:       "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  MERCADOPAGO:   "MercadoPago",
};

const METHOD_BADGE: Record<string, string> = {
  EFECTIVO:      "bg-emerald-100 text-emerald-700",
  TARJETA:       "bg-blue-100 text-blue-700",
  TRANSFERENCIA: "bg-violet-100 text-violet-700",
  MERCADOPAGO:   "bg-cyan-100 text-cyan-700",
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(isoString: string) {
  try {
    return new Date(isoString).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch {
    return "—";
  }
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-gray-200" /></td>
          <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-gray-200" /></td>
          <td className="px-4 py-3"><div className="h-5 w-24 rounded-full bg-gray-200" /></td>
          <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-20 rounded bg-gray-200" /></td>
          <td className="px-4 py-3" />
        </tr>
      ))}
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  payments: PaymentOut[];
  loading:  boolean;
  onDelete: (id: string) => void;
  deleting: string | null;
}

export function PaymentsTable({ payments, loading, onDelete, deleting }: Props) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left">Hora</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Método</th>
              <th className="px-4 py-3 text-right">Importe</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <TableSkeleton />
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Receipt className="h-8 w-8" />
                    <p className="text-sm">No hay cobros registrados este día</p>
                  </div>
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {formatTime(p.payment_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                    {p.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        METHOD_BADGE[p.payment_method] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                    ${fmt(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onDelete(p.id)}
                      disabled={deleting === p.id}
                      className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
                      aria-label="Eliminar cobro"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Footer con total */}
          {!loading && payments.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-100 bg-gray-50">
                <td colSpan={3} className="px-4 py-2.5 text-xs text-gray-400">
                  {payments.length} cobro{payments.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">
                  ${fmt(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
