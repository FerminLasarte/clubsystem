import { useLocalSearchParams } from "expo-router";

import { ReservationDetail } from "@/features/reservations/components/ReservationDetail";

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReservationDetail id={id} />;
}
