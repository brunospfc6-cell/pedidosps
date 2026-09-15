import { createFileRoute, Link } from "@tanstack/react-router";
import { SalesForm } from "@/components/sales-form";
import { useProfile } from "@/lib/profile-context";

type Search = { odc: number };

export const Route = createFileRoute("/_app/vendas/nova")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    odc: Number(s.odc) || 0,
  }),
  component: NovaVenda,
});

function NovaVenda() {
  const { odc } = Route.useSearch();
  const profile = useProfile();
  if (!odc) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl">Pedido de Venda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma ordem de compra finalizada para gerar o pedido de venda.
        </p>
        <Link to="/odc" className="mt-4 inline-block text-sm text-primary underline">
          Ir para ordens de compra
        </Link>
      </div>
    );
  }
  return <SalesForm odcId={odc} profile={profile} />;
}
