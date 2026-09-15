import { createFileRoute } from "@tanstack/react-router";
import { OdcForm } from "@/components/odc-form";

export const Route = createFileRoute("/_app/odc/nova")({ component: NovaOdc });

function NovaOdc() {
  return <OdcForm />;
}
