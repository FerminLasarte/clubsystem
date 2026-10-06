import type { Metadata } from "next";
import { Suspense } from "react";

import { MembersView } from "@/features/members/components/members-view";

export const metadata: Metadata = { title: "Socios" };

export default function MembersPage() {
  // MembersView lee pestaña, filtros y página de la URL (useSearchParams).
  return (
    <Suspense>
      <MembersView />
    </Suspense>
  );
}
