import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { Screen } from "@/shared/ui";

export default function ForgotPasswordScreen() {
  return (
    <Screen scroll edges={["bottom"]}>
      <ForgotPasswordForm />
    </Screen>
  );
}
