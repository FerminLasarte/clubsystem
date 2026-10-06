/** Mismo mínimo que el backend (`Password` en app/schemas/common.py). */
export const MIN_PASSWORD_LENGTH = 10;

/** Campo opcional de un formulario: vacío se manda como null. */
export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
