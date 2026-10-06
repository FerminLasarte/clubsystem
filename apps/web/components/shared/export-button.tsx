"use client";

import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadFile, type BlobRequest } from "@/lib/download";

/** Rango máximo de días de un export por fechas (el backend lo valida en `ExportRange`). */
export const MAX_EXPORT_DAYS = 366;

interface ExportButtonProps {
  /** Request del CSV con el cliente `api` (definida en el `api.ts` de la feature). */
  request: () => BlobRequest;
  /** Nombre de respaldo si el backend no propone uno. */
  filename: string;
  disabled?: boolean;
}

/** "Exportar CSV" con la sesión del panel (renueva el token si venció). Si falla, avisa con un toast. */
export function ExportButton({ request, filename, disabled }: ExportButtonProps) {
  const download = useMutation({ mutationFn: () => downloadFile(request(), filename) });
  return (
    <Button variant="outline" disabled={disabled || download.isPending} onClick={() => download.mutate()}>
      <Download className="size-4" aria-hidden /> {download.isPending ? "Exportando…" : "Exportar CSV"}
    </Button>
  );
}
