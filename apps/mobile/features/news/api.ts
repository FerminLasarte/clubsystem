import { unwrap } from "@clubsystem/api";

import { api } from "@/shared/api/client";

export const newsKeys = {
  mine: ["news", "mine"] as const,
};

export const newsApi = {
  mine: () => unwrap(api.GET("/api/v1/mobile/news")),
};
