export { createApiClient, unwrap } from "./client";
export type { ApiClient, ApiClientOptions, AuthMode } from "./client";
export { ApiError } from "./errors";
// schema.d.ts solo tiene tipos: se re-exporta como tipos (no existe en runtime).
export type * from "./schema";
