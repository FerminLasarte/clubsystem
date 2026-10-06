/** Error normalizado de la API. El backend responde `{ error: { code, message, fields?, request_id? } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: { field: string; message: string }[];
  readonly requestId: string | null;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: { field: string; message: string }[] = [],
    requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }

  static network(cause: unknown): ApiError {
    const timeout = cause instanceof DOMException && cause.name === "TimeoutError";
    return new ApiError(
      0,
      timeout ? "timeout" : "network",
      timeout
        ? "El servidor tardó demasiado en responder."
        : "No hay conexión con el servidor. Revisá tu conexión a internet.",
    );
  }
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: { field: string; message: string }[];
    request_id?: string | null;
  };
}

export function toApiError(status: number, body: unknown): ApiError {
  const err = (body as ErrorBody | undefined)?.error;
  return new ApiError(
    status,
    err?.code ?? "http_error",
    err?.message ?? `Error ${status}`,
    err?.fields ?? [],
    err?.request_id ?? null,
  );
}

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
