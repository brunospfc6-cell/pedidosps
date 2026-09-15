import { Send } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markOdcSent } from "@/lib/server/orders";

export function ConfirmSendOdc({
  orderId,
  orderNumber,
  onSent,
  variant = "default",
  size = "default",
  children,
}: {
  orderId: number;
  orderNumber: string;
  onSent?: () => void | Promise<void>;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await markOdcSent({ data: { id: orderId } });
      toast.success("Envio à PARS confirmado. A ordem não pode mais ser alterada.");
      setOpen(false);
      await onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao confirmar o envio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <Send />
        {children ?? "Confirmar Envio à PARS"}
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
            aria-labelledby={`confirm-send-${orderId}`}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={`confirm-send-${orderId}`} className="font-display text-xl tracking-tight">
              Confirmar Envio da {orderNumber}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Confirme somente depois que a ordem de compra for realmente enviada à PARS.
              A partir daí o pedido fica bloqueado e não poderá ser alterado nem corrigido.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={busy} onClick={confirm}>
                {busy ? "Confirmando…" : "Confirmar Envio"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
