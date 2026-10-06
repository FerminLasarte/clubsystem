import { ApiError } from "@clubsystem/api";

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** Mensaje para mostrar al usuario. Los de la API ya vienen en español. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Ocurrió un error inesperado.";
}

/** Error de validación (422) de un campo puntual del formulario, si lo hay. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.fields.find((f) => f.field === field)?.message;
}
