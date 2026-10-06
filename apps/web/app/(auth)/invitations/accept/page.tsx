import type { Metadata } from "next";

import { AcceptInvitation } from "@/features/auth/components/accept-invitation";

export const metadata: Metadata = { title: "Invitación" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AcceptInvitation token={token ?? ""} />;
}
