"use client";
// apps/web/app/(dashboard)/settings/_components/ClubTab.tsx

import { Building2, Clock, MapPin, Phone, ShieldAlert } from "lucide-react";
import { FieldInput } from "./FieldInput";
import type { ClubData } from "./types";

// ── Sub-components ────────────────────────────────────────────────────────────

interface ClubInfoCardProps {
  data:     ClubData;
  onChange: (data: ClubData) => void;
}

function ClubInfoCard({ data, onChange }: ClubInfoCardProps) {
  const update = (field: keyof ClubData, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <section
      aria-labelledby="club-info-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="club-info-heading"
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
        Información del Club
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldInput
          id="clubName"
          label="Nombre del club"
          colSpan="full"
          type="text"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Nombre de tu club"
          autoComplete="organization"
        />
        <FieldInput
          id="clubPhone"
          label="Teléfono"
          type="tel"
          value={data.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+54 249 000-0000"
          autoComplete="tel"
          leftSlot={<Phone className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface AddressCardProps {
  data:     ClubData;
  onChange: (data: ClubData) => void;
}

function AddressCard({ data, onChange }: AddressCardProps) {
  const update = (field: keyof ClubData, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <section
      aria-labelledby="address-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="address-heading"
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
        Dirección
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldInput
          id="address"
          label="Calle y número"
          colSpan="full"
          type="text"
          value={data.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="Av. Ejemplo 1234"
          autoComplete="street-address"
        />
        <FieldInput
          id="city"
          label="Ciudad"
          type="text"
          value={data.city}
          onChange={(e) => update("city", e.target.value)}
          placeholder="Ciudad"
          autoComplete="address-level2"
        />
        <FieldInput
          id="province"
          label="Provincia"
          type="text"
          value={data.province}
          onChange={(e) => update("province", e.target.value)}
          placeholder="Buenos Aires"
          autoComplete="address-level1"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface OperatingHoursCardProps {
  data:     ClubData;
  onChange: (data: ClubData) => void;
}

function OperatingHoursCard({ data, onChange }: OperatingHoursCardProps) {
  const update = (field: keyof ClubData, value: string) =>
    onChange({ ...data, [field]: value });

  const bothSet = data.openTime && data.closeTime;

  return (
    <section
      aria-labelledby="hours-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="hours-heading"
        className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
        Horarios de Operación
      </h2>
      <p className="mb-5 text-xs text-gray-400">
        Define cuándo opera el club. Se usa para generar la grilla de reservas de canchas.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldInput
          id="openTime"
          label="Apertura"
          type="time"
          value={data.openTime}
          onChange={(e) => update("openTime", e.target.value)}
        />
        <FieldInput
          id="closeTime"
          label="Cierre"
          type="time"
          value={data.closeTime}
          onChange={(e) => update("closeTime", e.target.value)}
        />
      </div>

      {bothSet && (
        <div className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
          El club estará disponible para reservas de{" "}
          <span className="font-semibold text-gray-900">{data.openTime}</span>
          {" "}a{" "}
          <span className="font-semibold text-gray-900">{data.closeTime}</span>{" "}hs.
          {" "}Las reservas fuera de este rango serán rechazadas automáticamente.
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface CancellationPolicyCardProps {
  data:     ClubData;
  onChange: (data: ClubData) => void;
}

function CancellationPolicyCard({ data, onChange }: CancellationPolicyCardProps) {
  return (
    <section
      aria-labelledby="cancellation-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="cancellation-heading"
        className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <ShieldAlert className="h-4 w-4 text-accent" aria-hidden="true" />
        Política de Cancelación
      </h2>
      <p className="mb-5 text-xs text-gray-400">
        Horas mínimas de anticipación para cancelar una reserva sin penalidad.
      </p>

      <div className="max-w-xs">
        <label htmlFor="cancelHours" className="block text-xs font-medium text-gray-700 mb-1.5">
          Horas de anticipación
        </label>
        <div className="flex items-center gap-2">
          <input
            id="cancelHours"
            type="number"
            min={0}
            max={168}
            value={data.cancellationPolicyHours}
            onChange={(e) =>
              onChange({ ...data, cancellationPolicyHours: Number(e.target.value) })
            }
            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400/20"
          />
          <span className="text-sm text-gray-500">horas</span>
        </div>
        {data.cancellationPolicyHours > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            Los socios podrán cancelar hasta{" "}
            <span className="font-semibold text-gray-700">{data.cancellationPolicyHours} hs</span>{" "}
            antes del turno sin penalidad.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Public tab ────────────────────────────────────────────────────────────────

interface ClubTabProps {
  data:     ClubData;
  onChange: (data: ClubData) => void;
}

export function ClubTab({ data, onChange }: ClubTabProps) {
  return (
    <div
      id="panel-club"
      role="tabpanel"
      aria-labelledby="tab-club"
      className="space-y-4"
    >
      <ClubInfoCard          data={data} onChange={onChange} />
      <AddressCard           data={data} onChange={onChange} />
      <OperatingHoursCard    data={data} onChange={onChange} />
      <CancellationPolicyCard data={data} onChange={onChange} />
    </div>
  );
}
