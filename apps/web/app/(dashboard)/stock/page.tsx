import type { Metadata } from "next";
import { Suspense } from "react";

import { StockView } from "@/features/stock/components/stock-view";

export const metadata: Metadata = { title: "Stock" };

export default function StockPage() {
  // Suspense: la vista lee filtros y página de la URL (useSearchParams).
  return (
    <Suspense>
      <StockView />
    </Suspense>
  );
}
