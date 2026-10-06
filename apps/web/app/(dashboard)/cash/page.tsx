import type { Metadata } from "next";
import { Suspense } from "react";

import { CashView } from "@/features/cash/components/cash-view";

export const metadata: Metadata = { title: "Caja" };

export default function CashPage() {
  // Suspense: la vista lee la fecha de los searchParams.
  return (
    <Suspense>
      <CashView />
    </Suspense>
  );
}
