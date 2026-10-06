import { unwrap } from "@clubsystem/api";

/** Resultado de `api.GET(..., { parseAs: "blob" })` (openapi-fetch). */
export type BlobRequest = Promise<{ data?: Blob; error?: unknown; response: Response }>;

/** Nombre del archivo que propone el backend (`Content-Disposition: attachment; filename="…"`). */
function filenameFrom(response: Response): string | null {
  const header = response.headers.get("content-disposition");
  return header?.match(/filename="?([^";]+)"?/)?.[1] ?? null;
}

/**
 * Guarda en el dispositivo el archivo que devuelve una request del cliente `api` (lib/api.ts).
 * Al pasar por el cliente, si el access token venció se renueva la sesión y se reintenta
 * (un `<a href>` directo a la API recibiría un 401 en JSON en vez del archivo).
 * Usa el nombre que propone el backend y, si no viene, `filename`. Lanza ApiError si falla.
 */
export async function downloadFile(request: BlobRequest, filename: string): Promise<void> {
  const blob = await unwrap(request);
  const { response } = await request;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFrom(response) ?? filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera después de que el navegador tomó el archivo.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
