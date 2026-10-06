import { errorMessage } from "@/lib/query-client";

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {errorMessage(error)}
    </p>
  );
}
