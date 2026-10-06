import type { ReservationOut } from "@clubsystem/api";
import { CANCEL_REASON_LABELS, formatDate, formatDateTime, formatMoney, formatTime, RESERVATION_SOURCE_LABELS } from "@clubsystem/shared";
import type { ReactNode } from "react";

import { formatDuration } from "@/features/reservations/time";

import { StatusBadge } from "./status-badge";

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function ReservationSummary({ reservation: r, timeZone }: { reservation: ReservationOut; timeZone: string }) {
  return (
    <dl className="grid grid-cols-2 gap-4">
      <Item label="Cliente">
        <span className="font-medium">{r.customer_name}</span>
        <span className="block text-xs text-muted-foreground">
          {r.customer_type === "MEMBER" ? `Socio${r.member_number ? ` N.º ${r.member_number}` : ""}` : "Invitado"}
          {r.customer_phone ? ` · ${r.customer_phone}` : ""}
        </span>
      </Item>
      <Item label="Estado">
        <StatusBadge status={r.status} />
        {r.cancel_reason ? (
          <span className="block text-xs text-muted-foreground">{CANCEL_REASON_LABELS[r.cancel_reason]}</span>
        ) : null}
      </Item>
      <Item label="Cancha">{r.court_name}</Item>
      <Item label="Fecha">{formatDate(r.starts_at, timeZone, { dateStyle: "full" })}</Item>
      <Item label="Horario">
        <span className="tabular">
          {formatTime(r.starts_at, timeZone)}–{formatTime(r.ends_at, timeZone)}
        </span>{" "}
        <span className="text-muted-foreground">({formatDuration(r.duration_minutes)})</span>
      </Item>
      <Item label="Origen">{RESERVATION_SOURCE_LABELS[r.source]}</Item>
      <Item label="Precio">
        <span className="tabular font-medium">{formatMoney(r.total_price)}</span>
      </Item>
      <Item label="Pagado">
        <span className="tabular">{formatMoney(r.paid_amount)}</span>
      </Item>
      <Item label="Creada">{formatDateTime(r.created_at, timeZone)}</Item>
      {r.confirmed_at ? <Item label="Confirmada">{formatDateTime(r.confirmed_at, timeZone)}</Item> : null}
      {r.cancelled_at ? <Item label="Cancelada">{formatDateTime(r.cancelled_at, timeZone)}</Item> : null}
    </dl>
  );
}
