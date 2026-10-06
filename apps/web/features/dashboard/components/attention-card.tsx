"use client";

import type { LowStockOut } from "@clubsystem/api";
import { STOCK_UNIT_LABELS } from "@clubsystem/shared";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveSession } from "@/features/auth/api";

const quantity = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

interface AttentionCardProps {
  pendingRequests: number;
  /** null cuando el rol no puede ver stock. */
  lowStock: LowStockOut | null;
}

function LowStock({ lowStock }: { lowStock: LowStockOut }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">
          {lowStock.count === 0
            ? "Sin artículos con stock bajo"
            : `${lowStock.count} ${lowStock.count === 1 ? "artículo" : "artículos"} con stock bajo`}
        </p>
        <Button variant="link" size="sm" asChild>
          <Link href="/stock">Ir a stock</Link>
        </Button>
      </div>
      {lowStock.items.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {lowStock.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span className="truncate">{item.name}</span>
              <span className="tabular shrink-0 text-warning-foreground">
                {quantity.format(Number(item.quantity))} / {quantity.format(Number(item.min_quantity))}{" "}
                {STOCK_UNIT_LABELS[item.unit]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Pendientes del staff: solicitudes de socios y artículos por debajo del mínimo. */
export function AttentionCard({ pendingRequests, lowStock }: AttentionCardProps) {
  const canSeeMembers = useActiveSession().permissions.includes("members:read");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Para atender</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">
            {pendingRequests === 0
              ? "Sin solicitudes de socios pendientes"
              : `${pendingRequests} ${pendingRequests === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`}
          </p>
          {pendingRequests > 0 && canSeeMembers ? (
            <Button variant="link" size="sm" asChild>
              <Link href="/members?status=PENDING">Revisar</Link>
            </Button>
          ) : null}
        </div>
        {lowStock ? <LowStock lowStock={lowStock} /> : null}
      </CardContent>
    </Card>
  );
}
