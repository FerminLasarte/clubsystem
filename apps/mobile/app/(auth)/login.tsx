import { LoginForm } from "@/features/auth/components/LoginForm";
import { Screen } from "@/shared/ui";

export default function LoginScreen() {
  return (
    <Screen scroll edges={["top", "bottom"]}>
      <LoginForm />
    </Screen>
  );
}
