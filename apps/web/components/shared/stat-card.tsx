import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
} as const;

interface StatCardProps {
  label: string;
  value: string | number | undefined;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, tone = "neutral", hint }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        {Icon ? (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {value === undefined ? (
            <Skeleton className="mt-1 h-6 w-20" />
          ) : (
            <p className="tabular truncate text-xl font-semibold">{value}</p>
          )}
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
