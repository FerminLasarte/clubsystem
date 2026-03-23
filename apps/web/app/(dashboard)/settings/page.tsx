"use client";
// apps/web/app/(dashboard)/settings/page.tsx
//
// Pantalla de Ajustes — integración completa con el backend real.
//
// Datos:   settingsApi.get()    → GET /api/v1/settings
//          settingsApi.update() → PUT /api/v1/settings  (solo OWNER)
//
// Secciones:
//   · Perfil       → actualiza User.first_name / last_name del admin logueado
//   · Club         → name, phone, address, city, horarios, política cancelación
//   · Pagos        → require_deposit, mercadopago_token
//   · Notificaciones → notif_whatsapp, notif_cancellation, notif_cash_report
//   · Equipo       → alta/edición de staff (gestión propia del StaffTab)

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";

import { ActionButton }     from "@/components/ui/action-button";
import { SettingsTabs }     from "./_components/SettingsTabs";
import { ProfileTab }       from "./_components/ProfileTab";
import { ClubTab }          from "./_components/ClubTab";
import { PaymentsTab }      from "./_components/PaymentsTab";
import { NotificationsTab } from "./_components/NotificationsTab";
import { StaffTab }         from "./_components/StaffTab";
import { settingsApi }      from "@/lib/api";

import {
  EMPTY_SETTINGS,
  type SettingsState,
  type TabId,
} from "./_components/types";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [settings,  setSettings]  = useState<SettingsState>(EMPTY_SETTINGS);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Carga inicial — datos reales desde /api/v1/settings ───────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoadError(null);
      try {
        const data = await settingsApi.get();
        if (cancelled) return;

        setSettings({
          profile: {
            fullName:  data.profile.fullName,
            email:     data.profile.email,
            avatarUrl: data.profile.avatarUrl ?? "",
          },
          club: {
            name:                    data.club.name,
            phone:                   data.club.phone    ?? "",
            address:                 data.club.address  ?? "",
            city:                    data.club.city     ?? "",
            province:                "",   // campo no persistido aún en el backend
            openTime:                data.club.openTime  ?? "",
            closeTime:               data.club.closeTime ?? "",
            cancellationPolicyHours: data.club.cancellationPolicyHours,
          },
          payments: {
            requireDeposit:   data.payments.requireDeposit,
            mercadopagoToken: data.payments.mercadopagoToken,
          },
          notifications: {
            whatsappNewReservations: data.notifications.whatsappNewReservations,
            cancellationAlerts:      data.notifications.cancellationAlerts,
            dailyCashReport:         data.notifications.dailyCashReport,
          },
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Error al cargar los ajustes."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => { cancelled = true; };
  }, []);

  // ── Guardar — PUT /api/v1/settings con la sección activa ──────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      if (activeTab === "profile") {
        await settingsApi.update({
          profile: { fullName: settings.profile.fullName },
        });

      } else if (activeTab === "club") {
        await settingsApi.update({
          club: {
            name:                    settings.club.name      || undefined,
            phone:                   settings.club.phone     || null,
            address:                 settings.club.address   || null,
            city:                    settings.club.city      || null,
            openTime:                settings.club.openTime  || null,
            closeTime:               settings.club.closeTime || null,
            cancellationPolicyHours: settings.club.cancellationPolicyHours,
          },
        });

      } else if (activeTab === "payments") {
        await settingsApi.update({
          payments: {
            requireDeposit:   settings.payments.requireDeposit,
            mercadopagoToken: settings.payments.mercadopagoToken || undefined,
          },
        });

      } else if (activeTab === "notifications") {
        await settingsApi.update({
          notifications: {
            whatsappNewReservations: settings.notifications.whatsappNewReservations,
            cancellationAlerts:      settings.notifications.cancellationAlerts,
            dailyCashReport:         settings.notifications.dailyCashReport,
          },
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Error al guardar los cambios."
      );
    } finally {
      setSaving(false);
    }
  };

  const patchSettings = <K extends keyof SettingsState>(
    section: K,
    value:   SettingsState[K],
  ) => setSettings((prev) => ({ ...prev, [section]: value }));

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="text-xl font-semibold text-gray-900">Ajustes</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Configurá el perfil del administrador, datos del club y preferencias del sistema.
          </p>
        </header>

        {/* Skeleton — misma estructura que el contenido para prevenir CLS */}
        <div className="flex gap-1 border-b border-gray-100 pb-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 animate-pulse rounded-md bg-gray-100"
            />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error de carga ─────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-gray-900">Ajustes</h1>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Error al cargar los ajustes</p>
            <p className="mt-0.5 text-xs opacity-80">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Page header ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ajustes</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Configurá el perfil del administrador, datos del club y preferencias del sistema.
          </p>
        </div>

        {/* Botón guardar — oculto en la pestaña Equipo (las acciones son inmediatas) */}
        {activeTab !== "staff" && (
          <div className="flex items-center gap-3">
            {saveError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {saveError}
              </p>
            )}
            <ActionButton
              onClick={handleSave}
              disabled={saving}
              variant={saved ? "outline" : "primary"}
              aria-live="polite"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Guardando…
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Guardado
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Guardar cambios
                </>
              )}
            </ActionButton>
          </div>
        )}
      </header>

      {/* ── Tab navigation ── */}
      <SettingsTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSaveError(null);
        }}
      />

      {/* ── Tab panels ── */}
      {activeTab === "profile" && (
        <ProfileTab
          data={settings.profile}
          onChange={(profile) => patchSettings("profile", profile)}
        />
      )}

      {activeTab === "club" && (
        <ClubTab
          data={settings.club}
          onChange={(club) => patchSettings("club", club)}
        />
      )}

      {activeTab === "payments" && (
        <PaymentsTab
          data={settings.payments}
          onChange={(payments) => patchSettings("payments", payments)}
        />
      )}

      {activeTab === "notifications" && (
        <NotificationsTab
          data={settings.notifications}
          onChange={(notifications) => patchSettings("notifications", notifications)}
        />
      )}

      {activeTab === "staff" && <StaffTab />}
    </div>
  );
}
