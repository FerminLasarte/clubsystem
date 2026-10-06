import type { Metadata } from "next";
import { Suspense } from "react";

import { FeesView } from "@/features/fees/components/fees-view";

export const metadata: Metadata = { title: "Cuotas" };

export default function FeesPage() {
  // Suspense: la vista lee período, filtros y página de los searchParams.
  return (
    <Suspense>
      <FeesView />
    </Suspense>
  );
}
