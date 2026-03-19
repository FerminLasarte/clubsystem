"use client";
// apps/web/app/(dashboard)/settings/page.tsx

import { useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

import { Button }            from "@/components/ui/button";
import { SettingsTabs }      from "./_components/SettingsTabs";
import { ProfileTab }        from "./_components/ProfileTab";
import { ClubTab }           from "./_components/ClubTab";
import { PaymentsTab }       from "./_components/PaymentsTab";
import { NotificationsTab }  from "./_components/NotificationsTab";
import { StaffTab }          from "./_components/StaffTab";

import {
  MOCK_SETTINGS,
  type SettingsState,
  type TabId,
} from "./_components/types";

// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [settings,  setSettings]  = useState<SettingsState>(MOCK_SETTINGS);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    // TODO: replace with real API call
    // await api.clubs.updateSettings(clubId, settings);
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const patchSettings = <K extends keyof SettingsState>(
    section: K,
    value:   SettingsState[K],
  ) => setSettings((prev) => ({ ...prev, [section]: value }));

  // ── Render ───────────────────────────────────────────────────────────────────

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
          <Button
            onClick={handleSave}
            disabled={saving}
            variant={saved ? "outline" : "default"}
            size="sm"
            className="gap-2"
            aria-live="polite"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Guardando…
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-foreground" aria-hidden="true" />
                Guardado
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                Guardar cambios
              </>
            )}
          </Button>
        )}
      </header>

      {/* ── Tab navigation ── */}
      <SettingsTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
