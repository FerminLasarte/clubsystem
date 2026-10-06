import type { Metadata } from "next";

import { CourtsView } from "@/features/courts/components/courts-view";

export const metadata: Metadata = { title: "Canchas" };

export default function CourtsPage() {
  return <CourtsView />;
}
