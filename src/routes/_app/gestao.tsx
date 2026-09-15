import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rowsToCsv } from "@/lib/export-doc";
import { useProfile } from "@/lib/profile-context";
import { directorOverview, exportOrdersCsv } from "@/lib/server/reports";
import { brl, downloadBlob, pct } from "@/lib/utils";

export const Route = createFileRoute("/_app/gestao")({ component: GestaoPage });

const COLORS = ["#1f4e57", "#5c6570", "#8a9aa3"];

function GestaoPage() {
  const profile = useProfile();
  const [data, setData] = useState<Awaited<ReturnType<typeof directorOverview>> | null>(null);

  useEffect(() => {
    directorOverview().then(setData).catch(() => setData(null));
  }, []);

  if (profile.role !== "administrador" && profile.role !== "diretor") {
    return <p className="text-sm text-muted-foreground">Acesso restrito à diretoria.</p>;
  }

  async function extract(kind: "odc" | "vendas") {
    try {
      const rows = await exportOrdersCsv({ data: { kind } });
      downloadBlob(new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" }), `${kind}.csv`);
      toast.success("Planilha gerada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na extração");
    }
  }

  const pie = (data?.byType ?? []).map((t) => ({
    name: t.type === "governo" ? "Governo" : "Privado",
    value: t.total,
  }));

  return (
    <div>
      <PageHeader
        title="Gestão e Análise"
        description="Visão do diretor: volume de vendas, margem, mix governo/privado e extração de planilhas."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => extract("odc")}>
              Extrair ODCs
            </Button>
            <Button type="button" variant="outline" onClick={() => extract("vendas")}>
              Extrair Vendas
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Mês</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data?.monthly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d4cdc0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Bar dataKey="total" fill="#1f4e57" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Sem vendas registradas.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Governo × Privado</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {pie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por Vendedor</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Vendedor</th>
                  <th className="px-3 py-2 font-medium">Pedidos</th>
                  <th className="px-3 py-2 font-medium">Margem méd.</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data?.bySeller ?? []).map((s) => (
                  <tr key={s.seller} className="border-b border-border last:border-0">
                    <td className="px-5 py-2">{s.seller}</td>
                    <td className="px-3 py-2 tabular-nums">{s.n}</td>
                    <td className="px-3 py-2 tabular-nums">{pct(s.margin)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{brl(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Qtd</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topProducts ?? []).map((p) => (
                  <tr key={p.name} className="border-b border-border last:border-0">
                    <td className="px-5 py-2">{p.name}</td>
                    <td className="px-3 py-2 tabular-nums">{p.qty}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{brl(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
