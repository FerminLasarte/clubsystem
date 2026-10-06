/**
 * Texto opcional de un formulario, recortado: vacío → null
 * (la API lo interpreta como "sin dato" o "limpiar el campo").
 */
export function optionalText(form: FormData, key: string): string | null {
  const text = form.get(key)?.toString().trim() ?? "";
  return text === "" ? null : text;
}
