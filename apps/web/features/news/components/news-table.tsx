"use client";

import type { NewsOut } from "@clubsystem/api";
import { formatDateTime } from "@clubsystem/shared";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActiveSession } from "@/features/auth/api";

interface NewsTableProps {
  news: NewsOut[];
  canWrite: boolean;
  onDelete: (news: NewsOut) => void;
}

export function NewsTable({ news, canWrite, onDelete }: NewsTableProps) {
  const timeZone = useActiveSession().active_club.timezone;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Novedad</TableHead>
          <TableHead>Etiqueta</TableHead>
          <TableHead>Publicada</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead>Publicó</TableHead>
          {canWrite ? (
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {news.map((item) => (
          <TableRow key={item.id} className={item.is_expired ? "text-muted-foreground" : undefined}>
            <TableCell className="max-w-md whitespace-normal">
              <p className="font-medium">{item.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
            </TableCell>
            <TableCell>{item.tag ? <Badge variant="secondary">{item.tag}</Badge> : "—"}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDateTime(item.created_at, timeZone)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {item.expires_at ? (
                <span className="inline-flex items-center gap-2">
                  {formatDateTime(item.expires_at, timeZone)}
                  {item.is_expired ? <Badge variant="outline">Vencida</Badge> : null}
                </span>
              ) : (
                "Sin vencimiento"
              )}
            </TableCell>
            <TableCell>{item.created_by_name ?? "—"}</TableCell>
            {canWrite ? (
              <TableCell>
                <Button variant="ghost" size="icon" aria-label={`Eliminar “${item.title}”`} onClick={() => onDelete(item)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
