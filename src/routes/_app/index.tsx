import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardStats, listPurchaseOrders } from "@/lib/server/orders";
import type { PurchaseOrder } from "@/lib/types";
import { brl, formatDateBR } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({ component: Home });

function Home() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof dashboardStats>> | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    dashboardStats().then(setStats).catch(() => {});
    listPurchaseOrders()
      .then((rows) => setOrders(rows.slice(0, 6)))
      .catch(() => setOrders([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Painel"
        description="Acompanhe ordens de compra, envios à PARS e o saldo HubGov."
        actions={
          <Button asChild>
            <Link to="/odc/nova">
              Nova Ordem de Compra <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ordens de Compra" value={String(stats?.odcCount ?? "—")} />
        <Stat label="Pendente PARS" value={String(stats?.pendingPars ?? "—")} />
        <Stat label="Vendas" value={stats ? brl(stats.salesTotal) : "—"} />
        <Stat
          label="Saldo HubGov"
          value={stats ? brl(stats.creditGenerated - stats.creditUsed) : "—"}
        />
      </div>
      <h2 className="mt-10 font-display text-xl">Pedidos Recentes</h2>
      <Card className="mt-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Ordens de Compra</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {orders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">Nenhuma ordem ainda. Crie a primeira ODC.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">
                      <Link to="/odc/$id" params={{ id: String(o.id) }} className="hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{o.clientName || "—"}</td>
                    <td className="px-3 py-3">{formatDateBR(o.orderDate)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{brl(o.netTotalBrl)}</td>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl tabular-nums tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
