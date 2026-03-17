"use client";
// apps/web/app/(dashboard)/settings/_components/NotificationsTab.tsx

import { type LucideIcon, Bell, FileText, MessageCircle, XCircle } from "lucide-react";
import { Switch } from "./Switch";
import type { NotificationSettings } from "./types";

// ── Notification row ──────────────────────────────────────────────────────────

interface NotificationRowProps {
  id:               string;
  icon:             LucideIcon;
  title:            string;
  description:      string;
  checked:          boolean;
  onCheckedChange:  (checked: boolean) => void;
}

function NotificationRow({
  id,
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: NotificationRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      {/* Icon + text */}
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50"
        >
          <Icon className="h-4 w-4 text-accent" />
        </div>

        <div className="space-y-0.5">
          <label
            htmlFor={id}
            className="block cursor-pointer text-sm font-medium text-gray-900"
          >
            {title}
          </label>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="shrink-0 pt-0.5">
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={title}
        />
      </div>
    </div>
  );
}

// ── Notification config ───────────────────────────────────────────────────────

type NotifKey = keyof NotificationSettings;

interface NotifConfig {
  key:         NotifKey;
  id:          string;
  icon:        LucideIcon;
  title:       string;
  description: string;
}

const NOTIFICATION_CONFIG: NotifConfig[] = [
  {
    key:         "whatsappNewReservations",
    id:          "notif-whatsapp",
    icon:        MessageCircle,
    title:       "Nuevas reservas por WhatsApp",
    description: "Recibí un mensaje de WhatsApp cada vez que se confirme una nueva reserva.",
  },
  {
    key:         "cancellationAlerts",
    id:          "notif-cancellation",
    icon:        XCircle,
    title:       "Alertas de cancelación",
    description: "Notificaciones inmediatas cuando un socio cancele o modifique una reserva.",
  },
  {
    key:         "dailyCashReport",
    id:          "notif-cash-report",
    icon:        FileText,
    title:       "Reporte diario de caja",
    description: "Recibí un resumen al cierre del día con el movimiento de caja del club.",
  },
];

// ── Public tab ────────────────────────────────────────────────────────────────

interface NotificationsTabProps {
  data:     NotificationSettings;
  onChange: (data: NotificationSettings) => void;
}

export function NotificationsTab({ data, onChange }: NotificationsTabProps) {
  const update = (field: NotifKey, value: boolean) =>
    onChange({ ...data, [field]: value });

  return (
    <div
      id="panel-notifications"
      role="tabpanel"
      aria-labelledby="tab-notifications"
      className="space-y-4"
    >
      <section
        aria-labelledby="notif-heading"
        className="rounded-xl border border-gray-100 bg-white p-6"
      >
        <h2
          id="notif-heading"
          className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-900"
        >
          <Bell className="h-4 w-4 text-accent" aria-hidden="true" />
          Preferencias de Notificación
        </h2>

        <div className="divide-y divide-gray-100">
          {NOTIFICATION_CONFIG.map((notif) => (
            <NotificationRow
              key={notif.key}
              id={notif.id}
              icon={notif.icon}
              title={notif.title}
              description={notif.description}
              checked={data[notif.key]}
              onCheckedChange={(v) => update(notif.key, v)}
            />
          ))}
        </div>
      </section>

      {/* Info banner */}
      <p className="px-1 text-xs text-gray-400">
        Las notificaciones de WhatsApp requieren integración activa con la API de WhatsApp Business.
        Configurala desde el panel de integraciones.
      </p>
    </div>
  );
}
