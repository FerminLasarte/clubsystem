"use client";

import type { NewsOut } from "@clubsystem/api";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { QueryError, StateView } from "@/components/shared/state-view";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSession } from "@/features/auth/api";
import { NEWS_PAGE_SIZE, useDeleteNews, useNews } from "@/features/news/api";
import { pageFromParams, useQueryParams } from "@/lib/use-query-params";

import { NewsDialog } from "./news-dialog";
import { NewsTable } from "./news-table";

export function NewsView() {
  const canWrite = useActiveSession().permissions.includes("news:write");
  const { params, set } = useQueryParams();
  const page = pageFromParams(params);
  const news = useNews(page);
  const remove = useDeleteNews();
  const [toDelete, setToDelete] = useState<NewsOut | null>(null);

  return (
    <>
      <PageHeader
        title="Novedades"
        description="Avisos que los socios ven en la app del club."
        actions={canWrite ? <NewsDialog /> : null}
      />
      <Card>
        <CardContent>
          {news.isPending ? (
            <Skeleton className="h-96 w-full" />
          ) : news.isError ? (
            <QueryError error={news.error} onRetry={() => news.refetch()} />
          ) : news.data.total === 0 ? (
            <StateView variant="empty" title="Todavía no se publicaron novedades" />
          ) : (
            <div aria-busy={news.isPlaceholderData}>
              <NewsTable news={news.data.items} canWrite={canWrite} onDelete={setToDelete} />
              <Pagination
                page={page}
                pageSize={NEWS_PAGE_SIZE}
                total={news.data.total}
                onPageChange={(next) => set({ page: next > 1 ? String(next) : null })}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminar novedad"
        description={`“${toDelete?.title ?? ""}” deja de verse en la app de los socios. No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </>
  );
}
