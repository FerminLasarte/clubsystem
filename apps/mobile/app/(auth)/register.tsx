import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { Screen } from "@/shared/ui";

export default function RegisterScreen() {
  return (
    <Screen scroll edges={["bottom"]}>
      <RegisterForm />
    </Screen>
  );
}
