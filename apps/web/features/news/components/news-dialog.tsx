"use client";

import { todayIn, zonedToIso } from "@clubsystem/shared";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveSession } from "@/features/auth/api";
import { useCreateNews } from "@/features/news/api";
import { optionalText } from "@/lib/form";

/** Sugerencias; la etiqueta es texto libre. */
const TAG_SUGGESTIONS = ["Aviso", "Clases", "Mantenimiento", "Torneo", "Promoción"];

export function NewsDialog() {
  const timeZone = useActiveSession().active_club.timezone;
  const [open, setOpen] = useState(false);
  const create = useCreateNews();

  function onOpenChange(next: boolean) {
    if (!next) create.reset();
    setOpen(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("expires_date"));
    const time = String(form.get("expires_time")) || "23:59";
    create.mutate(
      {
        title: String(form.get("title")).trim(),
        body: String(form.get("body")).trim(),
        tag: optionalText(form, "tag"),
        // La fecha y hora elegidas son las del club, no las del navegador.
        expires_at: date ? zonedToIso(date, time, timeZone) : null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden /> Nueva novedad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva novedad</DialogTitle>
          <DialogDescription>Los socios la ven en la app hasta que vence o se elimina.</DialogDescription>
        </DialogHeader>
        <form id="news-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <FormField id="title" label="Título" required maxLength={200} className="sm:col-span-2" />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="body">Texto</Label>
            <Textarea id="body" name="body" required maxLength={5000} rows={5} />
          </div>
          <div className="sm:col-span-2">
            <FormField id="tag" label="Etiqueta (opcional)" maxLength={50} list="news-tags" autoComplete="off" />
            <datalist id="news-tags">
              {TAG_SUGGESTIONS.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
          </div>
          <FormField id="expires_date" label="Vence el (opcional)" type="date" min={todayIn(timeZone)} />
          <FormField id="expires_time" label="Hora" type="time" defaultValue="23:59" hint="Hora del club." />
        </form>
        <FormError error={create.error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="news-form" disabled={create.isPending}>
            {create.isPending ? "Publicando…" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
