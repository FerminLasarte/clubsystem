import { unwrap, type NewsCreate } from "@clubsystem/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";

export const NEWS_PAGE_SIZE = 20;

const keys = {
  all: ["news"] as const,
  page: (page: number) => ["news", "page", page] as const,
};

export function useNews(page: number) {
  return useQuery({
    queryKey: keys.page(page),
    queryFn: () => unwrap(api.GET("/api/v1/admin/news", { params: { query: { page, page_size: NEWS_PAGE_SIZE } } })),
    placeholderData: keepPreviousData,
  });
}

export function useCreateNews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewsCreate) => unwrap(api.POST("/api/v1/admin/news", { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success("Novedad publicada");
    },
    meta: { silent: true },
  });
}

export function useDeleteNews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/admin/news/{news_id}", { params: { path: { news_id: id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success("Novedad eliminada");
    },
  });
}
