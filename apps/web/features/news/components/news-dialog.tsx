"use client";

import type { NewsOut } from "@clubsystem/api";
import { localDayOf, localTimeOf, todayIn, zonedToIso } from "@clubsystem/shared";
import type { FormEvent } from "react";

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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveSession } from "@/features/auth/api";
import { useCreateNews, useUpdateNews } from "@/features/news/api";
import { optionalText } from "@/lib/form";

/** Sugerencias; la etiqueta es texto libre. */
const TAG_SUGGESTIONS = ["Aviso", "Clases", "Mantenimiento", "Torneo", "Promoción"];

const minuteOf = (iso: string) => Math.floor(new Date(iso).getTime() / 60_000);

interface NewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null: novedad nueva. */
  news: NewsOut | null;
}

export function NewsDialog({ open, onOpenChange, news }: NewsDialogProps) {
  const timeZone = useActiveSession().active_club.timezone;
  const create = useCreateNews();
  const update = useUpdateNews();
  const mutation = news ? update : create;

  function onOpenChangeAndReset(next: boolean) {
    if (!next) {
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("expires_date"));
    const time = String(form.get("expires_time")) || "23:59";
    // La fecha y hora elegidas son las del club, no las del navegador.
    const expiresAt = date ? zonedToIso(date, time, timeZone) : null;
    const body = {
      title: String(form.get("title")).trim(),
      body: String(form.get("body")).trim(),
      tag: optionalText(form, "tag"),
    };
    const close = { onSuccess: () => onOpenChangeAndReset(false) };
    if (!news) {
      create.mutate({ ...body, expires_at: expiresAt }, close);
      return;
    }
    // El vencimiento se manda solo si cambió (al minuto, como el formulario): así se puede
    // editar el texto de una vencida sin que el backend rechace la fecha pasada.
    const sameExpiry =
      expiresAt === null ? news.expires_at === null : news.expires_at !== null && minuteOf(expiresAt) === minuteOf(news.expires_at);
    update.mutate({ id: news.id, body: sameExpiry ? body : { ...body, expires_at: expiresAt } }, close);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAndReset}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{news ? "Editar novedad" : "Nueva novedad"}</DialogTitle>
          <DialogDescription>
            {news
              ? "Los cambios se ven en la app de los socios al instante."
              : "Los socios la ven en la app hasta que vence o se elimina."}
          </DialogDescription>
        </DialogHeader>
        <form id="news-form" key={news?.id ?? "new"} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <FormField id="title" label="Título" defaultValue={news?.title} required maxLength={200} className="sm:col-span-2" />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="body">Texto</Label>
            <Textarea id="body" name="body" defaultValue={news?.body} required maxLength={5000} rows={5} />
          </div>
          <div className="sm:col-span-2">
            <FormField
              id="tag"
              label="Etiqueta (opcional)"
              defaultValue={news?.tag ?? ""}
              maxLength={50}
              list="news-tags"
              autoComplete="off"
            />
            <datalist id="news-tags">
              {TAG_SUGGESTIONS.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
          </div>
          <FormField
            id="expires_date"
            label="Vence el (opcional)"
            type="date"
            defaultValue={news?.expires_at ? localDayOf(news.expires_at, timeZone) : ""}
            // Una vencida conserva su fecha pasada si no se toca; el backend exige que una nueva sea futura.
            min={news?.is_expired ? undefined : todayIn(timeZone)}
          />
          <FormField
            id="expires_time"
            label="Hora"
            type="time"
            defaultValue={news?.expires_at ? localTimeOf(news.expires_at, timeZone) : "23:59"}
            hint="Hora del club."
          />
        </form>
        <FormError error={mutation.error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChangeAndReset(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="news-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : news ? "Guardar cambios" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
