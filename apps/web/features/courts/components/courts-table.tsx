"use client";

import type { CourtOut } from "@clubsystem/api";
import { formatMoney, SPORT_LABELS } from "@clubsystem/shared";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSetCourtActive } from "@/features/courts/api";
import { SURFACE_LABELS } from "@/features/courts/labels";
import { cn } from "@/lib/utils";

interface CourtsTableProps {
  courts: CourtOut[];
  canEdit: boolean;
  onEdit: (court: CourtOut) => void;
  onDelete: (court: CourtOut) => void;
}

export function CourtsTable({ courts, canEdit, onEdit, onDelete }: CourtsTableProps) {
  const setActive = useSetCourtActive();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cancha</TableHead>
          <TableHead>Deporte</TableHead>
          <TableHead>Superficie</TableHead>
          <TableHead>Techada</TableHead>
          <TableHead className="text-right">Capacidad</TableHead>
          <TableHead className="text-right">Socio / hora</TableHead>
          <TableHead className="text-right">Invitado / hora</TableHead>
          <TableHead>Activa</TableHead>
          {canEdit ? (
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {courts.map((court) => (
          <TableRow key={court.id} className={cn(!court.is_active && "text-muted-foreground")}>
            <TableCell>
              <p className="font-medium">{court.name}</p>
              {court.description ? (
                <p className="max-w-64 truncate text-xs text-muted-foreground">{court.description}</p>
              ) : null}
            </TableCell>
            <TableCell>{SPORT_LABELS[court.sport]}</TableCell>
            <TableCell>{court.surface ? SURFACE_LABELS[court.surface] : "—"}</TableCell>
            <TableCell>{court.is_indoor ? "Sí" : "No"}</TableCell>
            <TableCell className="tabular text-right">{court.capacity}</TableCell>
            <TableCell className="tabular text-right">{formatMoney(court.price_member)}</TableCell>
            <TableCell className="tabular text-right">{formatMoney(court.price_guest)}</TableCell>
            <TableCell>
              {canEdit ? (
                <Switch
                  checked={court.is_active}
                  disabled={setActive.isPending && setActive.variables.id === court.id}
                  onCheckedChange={(isActive) => setActive.mutate({ id: court.id, isActive })}
                  aria-label={`${court.name} activa`}
                />
              ) : (
                <Badge variant={court.is_active ? "secondary" : "outline"}>{court.is_active ? "Activa" : "Inactiva"}</Badge>
              )}
            </TableCell>
            {canEdit ? (
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Acciones de ${court.name}`}>
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(court)}>
                      <Pencil className="size-4" aria-hidden /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(court)}>
                      <Trash2 className="size-4" aria-hidden /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
