"use client";
// apps/web/app/(dashboard)/settings/_components/ProfileTab.tsx

import { useRef, useState } from "react";
import { Camera, KeyRound, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldInput } from "./FieldInput";
import type { AdminProfile } from "./types";

// ── Sub-components ────────────────────────────────────────────────────────────

interface AvatarCardProps {
  data:     AdminProfile;
  onChange: (data: AdminProfile) => void;
}

function AvatarCard({ data, onChange }: AvatarCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = data.fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange({ ...data, avatarUrl: url });
    e.target.value = "";
  };

  return (
    <section
      aria-labelledby="avatar-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="avatar-heading"
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <User className="h-4 w-4 text-accent" aria-hidden="true" />
        Foto de Perfil
      </h2>

      <div className="flex items-center gap-5">
        {/* Avatar circle */}
        <div className="relative shrink-0">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={`Avatar de ${data.fullName}`}
              className="h-20 w-20 rounded-full border-2 border-gray-100 object-cover"
            />
          ) : (
            <div
              aria-label={`Iniciales ${initials}`}
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-100 bg-brand text-xl font-semibold text-white"
            >
              {initials}
            </div>
          )}

          {/* Camera overlay button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Cambiar foto de perfil"
            className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
          >
            <Camera className="h-3.5 w-3.5 text-gray-600" aria-hidden="true" />
          </button>
        </div>

        {/* Info + CTA */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{data.fullName}</p>
          <p className="text-xs text-gray-400">Administrador del club</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 cursor-pointer text-xs text-gray-400 underline underline-offset-2 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
          >
            Cambiar imagen
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFile}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PersonalInfoCardProps {
  data:     AdminProfile;
  onChange: (data: AdminProfile) => void;
}

function PersonalInfoCard({ data, onChange }: PersonalInfoCardProps) {
  const update = (field: keyof AdminProfile, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <section
      aria-labelledby="personal-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <h2
        id="personal-heading"
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <Mail className="h-4 w-4 text-accent" aria-hidden="true" />
        Información Personal
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldInput
          id="fullName"
          label="Nombre completo"
          type="text"
          value={data.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          placeholder="Tu nombre completo"
          autoComplete="name"
        />
        <FieldInput
          id="email"
          label="Email"
          type="email"
          value={data.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="tu@email.com"
          autoComplete="email"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PasswordCard() {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-labelledby="password-heading"
      className="rounded-xl border border-gray-100 bg-white p-6"
    >
      <div className="flex items-center justify-between">
        <h2
          id="password-heading"
          className="flex items-center gap-2 text-sm font-semibold text-gray-900"
        >
          <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
          Contraseña
        </h2>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="cursor-pointer text-xs font-medium text-gray-400 underline underline-offset-2 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
        >
          {open ? "Cancelar" : "Cambiar contraseña"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FieldInput
            id="currentPassword"
            label="Contraseña actual"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <FieldInput
            id="newPassword"
            label="Nueva contraseña"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <div className="flex justify-end sm:col-span-2">
            <Button type="button" size="sm">
              Actualizar contraseña
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-400">
          Actualizá tu contraseña regularmente para mantener tu cuenta segura.
        </p>
      )}
    </section>
  );
}

// ── Public tab ────────────────────────────────────────────────────────────────

interface ProfileTabProps {
  data:     AdminProfile;
  onChange: (data: AdminProfile) => void;
}

export function ProfileTab({ data, onChange }: ProfileTabProps) {
  return (
    <div
      id="panel-profile"
      role="tabpanel"
      aria-labelledby="tab-profile"
      className="space-y-4"
    >
      <AvatarCard       data={data} onChange={onChange} />
      <PersonalInfoCard data={data} onChange={onChange} />
      <PasswordCard />
    </div>
  );
}
