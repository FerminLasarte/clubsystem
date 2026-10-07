import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring";

Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
