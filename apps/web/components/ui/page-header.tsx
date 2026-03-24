// components/ui/page-header.tsx
// Encabezado estándar del panel de administración.
// Usado en todas las páginas del dashboard para garantizar consistencia visual.
//
// Uso básico:
//   <PageHeader title="Socios" subtitle="120 socios registrados" />
//
// Con botones:
//   <PageHeader title="Novedades" subtitle="Publicaciones para socios">
//     <ActionButton icon={Plus}>Nueva novedad</ActionButton>
//   </PageHeader>
//
// Con contenido complejo a la derecha (date pickers, dropdowns, etc.):
//   <PageHeader title="Caja Diaria" subtitle={formatDisplayDate(date)}>
//     <div className="flex items-center gap-2">...</div>
//   </PageHeader>

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title:     string;
  subtitle?: ReactNode;
  /** Botones u otro contenido posicionado a la derecha del título. */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle != null && (
          <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
