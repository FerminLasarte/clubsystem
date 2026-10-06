import type { Metadata } from "next";
import { Suspense } from "react";

import { NewsView } from "@/features/news/components/news-view";

export const metadata: Metadata = { title: "Novedades" };

export default function NewsPage() {
  // Suspense: la vista lee la página de la URL (useSearchParams).
  return (
    <Suspense>
      <NewsView />
    </Suspense>
  );
}
