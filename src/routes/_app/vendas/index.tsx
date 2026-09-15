import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { listSalesOrders } from "@/lib/server/orders";
import type { SalesOrder } from "@/lib/types";
import { brl, formatDateBR } from "@/lib/utils";

export const Route = createFileRoute("/_app/vendas/")({ component: VendasList });

function VendasList() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);

  const load = useCallback(async () => {
    try {
      setOrders(await listSalesOrders());
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Pedidos de Venda"
        description="Gerados a partir de uma ordem de compra finalizada. Valores de venda e margem são preenchidos pelo vendedor."
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {orders.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">
              Nenhum pedido de venda. Finalize uma ODC para iniciar.
            </p>
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-3 py-3 font-medium">ODC</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">
                      <Link className="hover:underline" to="/vendas/$id" params={{ id: String(o.id) }}>
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{o.purchaseOrderNumber}</td>
                    <td className="px-3 py-3">{o.clientName}</td>
                    <td className="px-3 py-3 capitalize">{o.clientType}</td>
                    <td className="px-3 py-3">{formatDateBR(o.orderDate)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={o.status === "cancelado" ? "cancelado" : "aberto"} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(o.saleTotalBrl)}</td>
                    <td className="px-5 py-3">
                      {o.status !== "cancelado" ? (
                        <ConfirmCancel
                          kind="venda"
                          orderId={o.id}
                          orderNumber={o.number}
                          size="sm"
                          onCancelled={load}
                        >
                          Cancelar
                        </ConfirmCancel>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
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
