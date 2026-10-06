import type { MethodTotals } from "@clubsystem/api";
import { formatMoney, PAYMENT_METHOD_LABELS } from "@clubsystem/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Totales del día por método de pago (para el arqueo). */
export function MethodTotalsTable({ totals }: { totals: MethodTotals[] }) {
  if (totals.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por método de pago</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Egresos</TableHead>
              <TableHead className="text-right">Neto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.map((row) => (
              <TableRow key={row.method}>
                <TableCell>{PAYMENT_METHOD_LABELS[row.method]}</TableCell>
                <TableCell className="tabular text-right">{formatMoney(row.income)}</TableCell>
                <TableCell className="tabular text-right">{formatMoney(row.outflow)}</TableCell>
                <TableCell className="tabular text-right font-medium">{formatMoney(row.net)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
