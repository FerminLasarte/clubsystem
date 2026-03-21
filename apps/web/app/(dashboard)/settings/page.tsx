"use client";
// apps/web/app/(dashboard)/settings/page.tsx

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

import { ActionButton }      from "@/components/ui/action-button";
import { SettingsTabs }      from "./_components/SettingsTabs";
import { ProfileTab }        from "./_components/ProfileTab";
import { ClubTab }           from "./_components/ClubTab";
import { PaymentsTab }       from "./_components/PaymentsTab";
import { NotificationsTab }  from "./_components/NotificationsTab";
import { StaffTab }          from "./_components/StaffTab";
import { clubApi }           from "@/lib/api";

import {
  MOCK_SETTINGS,
  type SettingsState,
  type TabId,
} from "./_components/types";

// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [settings,  setSettings]  = useState<SettingsState>(MOCK_SETTINGS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Carga inicial — datos reales del club ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function loadClub() {
      try {
        const data = await clubApi.getSettings();
        if (cancelled) return;
        setSettings((prev) => ({
          ...prev,
          club: {
            name:                    data.name,
            phone:                   data.phone    ?? "",
            address:                 data.address  ?? "",
            city:                    data.city     ?? "",
            province:                prev.club.province,    // no está en el backend todavía
            openTime:                data.open_time  ? data.open_time.slice(0, 5)  : "",
            closeTime:               data.close_time ? data.close_time.slice(0, 5) : "",
            cancellationPolicyHours: data.cancellation_policy_hours,
          },
        }));
      } catch {
        // Si falla (403, red, etc.) se muestran los MOCK_SETTINGS como fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadClub();
    return () => { cancelled = true; };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      if (activeTab === "club") {
        // Guardar configuración real del club vía API
        await clubApi.updateSettings({
          name:                       settings.club.name       || undefined,
          phone:                      settings.club.phone      || null,
          address:                    settings.club.address    || null,
          city:                       settings.club.city       || null,
          open_time:                  settings.club.openTime   || null,
          close_time:                 settings.club.closeTime  || null,
          cancellation_policy_hours:  settings.club.cancellationPolicyHours,
        });
      } else {
        // Otros tabs: simular guardado (TODO: conectar sus propias APIs)
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
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

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

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

        {/* Save button — oculto en la pestaña Equipo (las invitaciones son inmediatas) */}
        {activeTab !== "staff" && (
          <div className="flex items-center gap-3">
            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
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
