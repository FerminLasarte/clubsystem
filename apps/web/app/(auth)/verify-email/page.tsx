import type { Metadata } from "next";

import { VerifyEmail } from "@/features/auth/components/verify-email";

export const metadata: Metadata = { title: "Confirmar email" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <VerifyEmail token={token ?? ""} />;
}
