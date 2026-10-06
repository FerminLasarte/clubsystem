import { errorMessage } from "@clubsystem/api";
import { Button, Notice } from "@/shared/ui";

import { useResendVerification, useSession } from "../hooks";

/** Aviso con "reenviar" mientras el email no esté confirmado (sin eso no se puede pedir ser socio). */
export function EmailVerificationNotice() {
  const { data } = useSession();
  const resend = useResendVerification();

  if (!data || data.user.email_verified) return null;

  const message = resend.isSuccess
    ? `Te reenviamos el enlace a ${data.user.email}. Revisá también la carpeta de spam.`
    : resend.isError
      ? errorMessage(resend.error)
      : `Te enviamos un enlace a ${data.user.email}. Lo necesitás para pedir ser socio de un club.`;

  return (
    <Notice tone="warning" title="Confirmá tu email" message={message}>
      {!resend.isSuccess ? (
        <Button title="Reenviar email" variant="secondary" onPress={() => resend.mutate()} loading={resend.isPending} />
      ) : null}
    </Notice>
  );
}
