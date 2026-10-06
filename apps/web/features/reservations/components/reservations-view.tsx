"use client";

import { todayIn } from "@clubsystem/shared";
import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveSession } from "@/features/auth/api";
import { parseDay } from "@/features/reservations/time";
import { useUrlParams } from "@/features/reservations/use-url-params";

import { CreateReservationDialog } from "./create-reservation-dialog";
import { DayView } from "./day-view";
import { ReservationDetailDialog } from "./reservation-detail-dialog";
import { ReservationHistory } from "./reservation-history";
import type { SlotDefaults } from "./slot-fields";

/**
 * components/ui/tabs usa las variantes `data-horizontal`/`data-active` de shadcn, que no están
 * definidas en globals.css (Radix emite data-orientation/data-state): se aplican acá a mano.
 */
const TRIGGER_CLASS = "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm";

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
  const day = parseDay(params.get("date")) ?? today;

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
      <Tabs className="flex-col" value={view} onValueChange={(value) => update({ view: value === "history" ? value : null })}>
        <TabsList className="h-8">
          <TabsTrigger value="grid" className={TRIGGER_CLASS}>
            Grilla
          </TabsTrigger>
          <TabsTrigger value="history" className={TRIGGER_CLASS}>
            Historial
          </TabsTrigger>
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
