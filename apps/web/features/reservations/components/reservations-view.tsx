"use client";

import { isIsoDay, todayIn } from "@clubsystem/shared";
import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveSession } from "@/features/auth/api";
import { useUrlParams } from "@/lib/use-url-params";

import { CreateReservationDialog } from "./create-reservation-dialog";
import { DayView } from "./day-view";
import { ReservationDetailDialog } from "./reservation-detail-dialog";
import { ReservationHistory } from "./reservation-history";
import type { SlotDefaults } from "./slot-fields";

/** Estado de un diálogo que conserva su contenido al cerrar (para la animación de salida). */
interface DialogState<T> {
  open: boolean;
  value: T;
}

export function ReservationsView() {
  const { active_club, permissions } = useActiveSession();
  const canWrite = permissions.includes("reservations:write");
  const timeZone = active_club.timezone;
  const today = todayIn(timeZone);

  const [params, update] = useUrlParams();
  const view = params.get("view") === "history" ? "history" : "grid";
  const requestedDay = params.get("date");
  const day = isIsoDay(requestedDay) ? requestedDay : today;

  const [create, setCreate] = useState<DialogState<SlotDefaults>>({ open: false, value: { day } });
  const [detail, setDetail] = useState<DialogState<string | null>>({ open: false, value: null });

  const openCreate = (defaults: SlotDefaults) => setCreate({ open: true, value: defaults });
  const openDetail = (id: string) => setDetail({ open: true, value: id });

  return (
    <>
      <PageHeader
        title="Reservas"
        description={`Horarios en la zona del club (${timeZone}).`}
        actions={
          canWrite ? (
            <Button onClick={() => openCreate({ day })}>
              <Plus className="size-4" aria-hidden /> Nueva reserva
            </Button>
          ) : null
        }
      />
      <Tabs value={view} onValueChange={(value) => update({ view: value === "history" ? value : null })}>
        <TabsList>
          <TabsTrigger value="grid">Grilla</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="grid" className="pt-4">
          <DayView
            day={day}
            today={today}
            onDayChange={(next) => update({ date: next === today ? null : next })}
            onSelect={openDetail}
            onCreateAt={canWrite ? (courtId, time) => openCreate({ day, courtId, time }) : undefined}
          />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <ReservationHistory today={today} timeZone={timeZone} onSelect={openDetail} />
        </TabsContent>
      </Tabs>
      {canWrite ? (
        <CreateReservationDialog
          open={create.open}
          onOpenChange={(open) => setCreate((prev) => ({ ...prev, open }))}
          defaults={create.value}
          onCreated={(id) => {
            setCreate((prev) => ({ ...prev, open: false }));
            openDetail(id);
          }}
        />
      ) : null}
      <ReservationDetailDialog
        open={detail.open}
        onOpenChange={(open) => setDetail((prev) => ({ ...prev, open }))}
        reservationId={detail.value}
      />
    </>
  );
}
