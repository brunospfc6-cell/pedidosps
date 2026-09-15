import { createFileRoute } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { SalesForm } from "@/components/sales-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { downloadWord, salesDocumentHtml } from "@/lib/export-doc";
import { useProfile } from "@/lib/profile-context";
import { getSalesOrder } from "@/lib/server/orders";
import type { SalesOrder } from "@/lib/types";

export const Route = createFileRoute("/_app/vendas/$id")({ component: VendaDetail });

function VendaDetail() {
  const { id } = Route.useParams();
  const profile = useProfile();
  const [order, setOrder] = useState<SalesOrder | null>(null);

  const load = useCallback(async () => {
    try {
      const fresh = await getSalesOrder({ data: { id: Number(id) } });
      setOrder(fresh);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!order) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const cancelled = order.status === "cancelado";

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status === "cancelado" ? "cancelado" : "aberto"} />
        <Button
          type="button"
          variant="outline"
          onClick={() => downloadWord(`${order.number}.doc`, salesDocumentHtml(order))}
        >
          Extrair Word
        </Button>
        {!cancelled ? (
          <ConfirmCancel
            kind="venda"
            orderId={order.id}
            orderNumber={order.number}
            onCancelled={load}
          />
        ) : null}
      </div>
      {cancelled ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-card p-4 text-sm">
          <Ban className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="font-medium">Pedido de Venda Cancelado</p>
            <p className="text-muted-foreground">Este pedido foi cancelado e não pode mais ser alterado.</p>
          </div>
        </div>
      ) : null}
      <SalesForm
        odcId={order.purchaseOrderId}
        existing={order}
        profile={profile}
        locked={cancelled}
        onUpdated={load}
      />
    </div>
  );
}
