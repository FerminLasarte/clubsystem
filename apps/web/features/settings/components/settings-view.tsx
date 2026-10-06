"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useActiveSession } from "@/features/auth/api";

import { ClubForm } from "./club-form";
import { ProfileSection } from "./profile-section";
import { TeamSection } from "./team-section";

export function SettingsView() {
  const { permissions } = useActiveSession();
  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="grid gap-6">
        <ProfileSection />
        {permissions.includes("settings:read") ? <ClubForm canEdit={permissions.includes("settings:write")} /> : null}
        {permissions.includes("staff:manage") ? <TeamSection /> : null}
      </div>
    </>
  );
}
