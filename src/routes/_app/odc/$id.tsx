import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, FileDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { ConfirmSendOdc } from "@/components/confirm-send-odc";
import { OdcForm } from "@/components/odc-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadWord, odcDocumentHtml } from "@/lib/export-doc";
import { getPurchaseOrder } from "@/lib/server/orders";
import type { PurchaseOrder } from "@/lib/types";
import { formatDateBR } from "@/lib/utils";

export const Route = createFileRoute("/_app/odc/$id")({ component: OdcDetail });

function OdcDetail() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);

  const load = useCallback(async () => {
    try {
      const fresh = await getPurchaseOrder({ data: { id: Number(id) } });
      setOrder(fresh);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!order) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const locked = order.status === "enviado_pars" || order.status === "cancelado";
  const pending = order.status === "pendente_envio";
  const cancelled = order.status === "cancelado";
  const orderNumber = order.number;
  const wordHtml = odcDocumentHtml(order, { includeStatus: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        <Button
          type="button"
          variant="outline"
          onClick={() => downloadWord(`${orderNumber}.doc`, wordHtml)}
        >
          <FileDown />
          Extrair Word
        </Button>
        {!cancelled && order.status !== "rascunho" ? (
          <Button asChild variant="secondary">
            <Link to="/vendas/nova" search={{ odc: order.id }}>
              Pedido de Venda
            </Link>
          </Button>
        ) : null}
        {!cancelled ? (
          <ConfirmCancel kind="odc" orderId={order.id} orderNumber={order.number} onCancelled={load} />
        ) : null}
      </div>

      {pending ? (
        <Card className="border-warn/40 bg-accent">
          <CardHeader>
            <CardTitle>Ordem Finalizada — Confirme o Envio</CardTitle>
            <CardDescription>
              Esta ODC está pendente de envio à PARS. Depois de confirmar, o pedido
              não poderá mais ser alterado ou corrigido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmSendOdc orderId={order.id} orderNumber={order.number} onSent={load} />
          </CardContent>
        </Card>
      ) : null}

      {cancelled ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-card p-4 text-sm">
          <Ban className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="font-medium">Ordem de Compra Cancelada</p>
            <p className="text-muted-foreground">
              Este pedido foi cancelado e não pode mais ser alterado, enviado ou faturado.
            </p>
          </div>
        </div>
      ) : null}

      {order.status === "enviado_pars" ? (
        <div className="flex items-start gap-3 rounded-xl border border-ok/30 bg-card p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 text-ok" />
          <div>
            <p className="font-medium">Envio à PARS Confirmado</p>
            <p className="text-muted-foreground">
              {order.sentAt
                ? `Registrado em ${formatDateBR(order.sentAt.slice(0, 10))}. Esta ordem está bloqueada.`
                : "Esta ordem está bloqueada e não pode mais ser alterada."}
            </p>
          </div>
        </div>
      ) : null}

      <OdcForm existing={order} locked={locked} onUpdated={load} />
    </div>
  );
}
