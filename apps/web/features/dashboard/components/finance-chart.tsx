import type { MonthFinance } from "@clubsystem/api";
import { formatMoney, monthLabel } from "@clubsystem/shared";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SERIES = [
  { key: "income", label: "Ingresos", color: "bg-success" },
  { key: "cash_outflow", label: "Egresos de caja", color: "bg-warning" },
  { key: "expenses", label: "Gastos", color: "bg-destructive" },
] as const;

/** Barras con divs (sin librería). Los valores para lectores de pantalla van en una tabla oculta. */
export function FinanceChart({ series }: { series: MonthFinance[] }) {
  // Number() solo para la proporción visual de las barras; los montos se muestran con formatMoney.
  const max = Math.max(0, ...series.flatMap((month) => SERIES.map((s) => Number(month[s.key]))));
  const columns = { gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos 6 meses</CardTitle>
        <CardDescription className="flex flex-wrap gap-4">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", s.color)} aria-hidden />
              {s.label}
            </span>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div aria-hidden className="grid h-48 items-end gap-3 border-b" style={columns}>
          {series.map((month) => (
            <div key={`${month.year}-${month.month}`} className="flex h-full items-end justify-center gap-1">
              {SERIES.map((s) => (
                <div
                  key={s.key}
                  className={cn("w-full max-w-4 rounded-t-sm", s.color)}
                  style={{ height: max > 0 ? `${(Number(month[s.key]) / max) * 100}%` : 0 }}
                  title={`${s.label}: ${formatMoney(month[s.key])}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div aria-hidden className="mt-2 grid gap-3 text-center text-xs text-muted-foreground" style={columns}>
          {series.map((month) => (
            <span key={`${month.year}-${month.month}`}>{monthLabel(month.year, month.month, true)}</span>
          ))}
        </div>
        <Table className="sr-only">
          <caption>Ingresos, egresos de caja, gastos, resultado y caja por mes</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Mes</TableHead>
              {SERIES.map((s) => (
                <TableHead key={s.key}>{s.label}</TableHead>
              ))}
              <TableHead>Resultado</TableHead>
              <TableHead>Caja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.map((month) => (
              <TableRow key={`${month.year}-${month.month}`}>
                <TableCell>{monthLabel(month.year, month.month)}</TableCell>
                {SERIES.map((s) => (
                  <TableCell key={s.key}>{formatMoney(month[s.key])}</TableCell>
                ))}
                <TableCell>{formatMoney(month.result)}</TableCell>
                <TableCell>{formatMoney(month.cash_balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
