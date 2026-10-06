import type { Metadata } from "next";
import { Suspense } from "react";

import { ReservationsView } from "@/features/reservations/components/reservations-view";

export const metadata: Metadata = { title: "Reservas" };

export default function ReservationsPage() {
  // ReservationsView lee la fecha y los filtros de la URL (useSearchParams).
  return (
    <Suspense>
      <ReservationsView />
    </Suspense>
  );
}
