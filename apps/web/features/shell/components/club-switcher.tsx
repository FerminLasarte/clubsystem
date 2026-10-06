"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveSession, useSwitchClub } from "@/features/auth/api";

export function ClubSwitcher() {
  const router = useRouter();
  const { clubs, active_club } = useActiveSession();
  const switchClub = useSwitchClub();

  if (clubs.length < 2) {
    return <p className="truncate px-3 text-sm font-semibold">{active_club.name}</p>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between" disabled={switchClub.isPending}>
          <span className="truncate font-semibold">{active_club.name}</span>
          <ChevronsUpDown className="size-4 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Cambiar de club</DropdownMenuLabel>
        {clubs.map((club) => (
          <DropdownMenuItem
            key={club.club_id}
            onSelect={() => switchClub.mutate(club.club_id, { onSuccess: () => router.push("/") })}
          >
            <span className="truncate">{club.name}</span>
            {club.club_id === active_club.club_id ? <Check className="ml-auto size-4" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
