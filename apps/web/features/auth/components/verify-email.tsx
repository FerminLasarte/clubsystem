"use client";

import { AuthCard } from "@/components/shared/auth-card";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { useVerifyEmail } from "@/features/auth/api";

// La verificación es una acción explícita (no se dispara al cargar) para que los
// escáneres de links de los clientes de email no consuman el token.
export function VerifyEmail({ token }: { token: string }) {
  const verify = useVerifyEmail();

  if (verify.isSuccess) {
    return <AuthCard title="Email confirmado" description="Ya podés volver a la app." />;
  }
  return (
    <AuthCard title="Confirmá tu email">
      <div className="grid gap-4">
        <FormError error={verify.error} />
        <Button onClick={() => verify.mutate(token)} disabled={verify.isPending || !token}>
          Confirmar email
        </Button>
      </div>
    </AuthCard>
  );
}
