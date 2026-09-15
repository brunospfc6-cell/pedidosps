import { Ban } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelPurchaseOrder, cancelSalesOrder } from "@/lib/server/orders";

export function ConfirmCancel({
  kind,
  orderId,
  orderNumber,
  onCancelled,
  size = "default",
  children,
}: {
  kind: "odc" | "venda";
  orderId: number;
  orderNumber: string;
  onCancelled?: () => void | Promise<void>;
  size?: "default" | "sm";
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = kind === "odc" ? "Ordem de Compra" : "Pedido de Venda";

  async function confirm() {
    setBusy(true);
    try {
      if (kind === "odc") await cancelPurchaseOrder({ data: { id: orderId } });
      else await cancelSalesOrder({ data: { id: orderId } });
      toast.success(
        kind === "odc"
          ? "Ordem de compra cancelada. Pedido de venda vinculado e créditos HubGov deste pedido foram estornados."
          : "Pedido de venda cancelado.",
      );
      setOpen(false);
      await onCancelled?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao cancelar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="destructive" size={size} onClick={() => setOpen(true)}>
        <Ban />
        {children ?? `Cancelar ${kind === "odc" ? "ODC" : "venda"}`}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`confirm-cancel-${kind}-${orderId}`}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={`confirm-cancel-${kind}-${orderId}`}
              className="font-display text-xl tracking-tight"
            >
              Cancelar {label} {orderNumber}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {kind === "odc"
                ? "A ordem será cancelada e não poderá mais ser editada ou enviada. Se existir pedido de venda, ele também será cancelado. Créditos HubGov lançados neste pedido serão estornados."
                : "O pedido de venda será cancelado e não poderá mais ser editado. A ordem de compra permanece como está."}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Voltar
              </Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={confirm}>
                {busy ? "Cancelando…" : "Confirmar Cancelamento"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
