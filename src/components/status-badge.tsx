import { Badge } from "@/components/ui/badge";
import type { OdcStatus, SalesStatus } from "@/lib/types";
import { SALES_STATUS_LABEL, STATUS_LABEL } from "@/lib/types";

export function StatusBadge({ status }: { status: OdcStatus | SalesStatus }) {
  const variant =
    status === "enviado_pars"
      ? "ok"
      : status === "pendente_envio"
        ? "warn"
        : status === "cancelado"
          ? "danger"
          : "muted";
  const label =
    status in STATUS_LABEL
      ? STATUS_LABEL[status as OdcStatus]
      : SALES_STATUS_LABEL[status as SalesStatus];
  return <Badge variant={variant}>{label}</Badge>;
}
