import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { ConfirmSendOdc } from "@/components/confirm-send-odc";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listPurchaseOrders } from "@/lib/server/orders";
import type { PurchaseOrder } from "@/lib/types";
import { brl, formatDateBR } from "@/lib/utils";

export const Route = createFileRoute("/_app/odc/")({ component: OdcList });

function OdcList() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const load = useCallback(async () => {
    try {
      setOrders(await listPurchaseOrders());
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Ordens de Compra"
        description="Após finalizar, confirme o envio à PARS. Depois de confirmado, o pedido não pode mais ser alterado."
        actions={
          <Button asChild>
            <Link to="/odc/nova">Nova ODC</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {orders.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">Nenhuma ordem cadastrada.</p>
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Líquido</th>
                  <th className="px-5 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">
                      <Link className="hover:underline" to="/odc/$id" params={{ id: String(o.id) }}>
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{o.clientName || "—"}</td>
                    <td className="px-3 py-3 capitalize">{o.clientType}</td>
                    <td className="px-3 py-3">{formatDateBR(o.orderDate)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(o.netTotalBrl)}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {o.status === "pendente_envio" ? (
                          <ConfirmSendOdc
                            orderId={o.id}
                            orderNumber={o.number}
                            size="sm"
                            onSent={load}
                          >
                            Confirmar envio
                          </ConfirmSendOdc>
                        ) : null}
                        {o.status !== "cancelado" ? (
                          <ConfirmCancel
                            kind="odc"
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
                      </div>
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
