import type { Metadata } from "next";
import { Suspense } from "react";

import { ExpensesView } from "@/features/expenses/components/expenses-view";

export const metadata: Metadata = { title: "Gastos" };

export default function ExpensesPage() {
  // Los filtros viven en la URL (useSearchParams necesita un límite de Suspense).
  return (
    <Suspense>
      <ExpensesView />
    </Suspense>
  );
}
