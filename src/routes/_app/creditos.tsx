import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { creditSummary, listCredits } from "@/lib/server/catalog";
import type { HubgovEntry } from "@/lib/types";
import { brl, formatDateBR } from "@/lib/utils";

export const Route = createFileRoute("/_app/creditos")({ component: CreditosPage });

function CreditosPage() {
  const [summary, setSummary] = useState<{ generated: number; used: number; remaining: number } | null>(null);
  const [rows, setRows] = useState<HubgovEntry[]>([]);

  useEffect(() => {
    creditSummary().then(setSummary).catch(() => {});
    listCredits().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Créditos HubGov"
        description="Pedidos de governo geram crédito a partir de 8% sobre o valor de lista. O saldo pode ser usado em pedidos futuros, com a NF de origem."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Gerado</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{brl(summary?.generated ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Utilizado</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{brl(summary?.used ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{brl(summary?.remaining ?? 0)}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">Nenhum movimento de crédito ainda.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 font-medium">NF</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">{formatDateBR(r.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={r.kind === "generated" ? "ok" : "warn"}>
                        {r.kind === "generated" ? "Gerado" : "Utilizado"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{r.nfNumber || "—"}</td>
                    <td className="px-3 py-3">{r.clientName || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{brl(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
