import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/lib/profile-context";
import { addExternalCredit, creditSummary, listClients, listCredits } from "@/lib/server/catalog";
import type { Client, HubgovEntry } from "@/lib/types";
import { brl, formatDateBR } from "@/lib/utils";

export const Route = createFileRoute("/_app/creditos")({ component: CreditosPage });

function CreditosPage() {
  const profile = useProfile();
  const admin = profile.role === "administrador";
  const [summary, setSummary] = useState<{ generated: number; used: number; remaining: number } | null>(null);
  const [rows, setRows] = useState<HubgovEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [nf, setNf] = useState("");
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    creditSummary().then(setSummary).catch(() => {});
    listCredits().then(setRows).catch(() => setRows([]));
  }

  useEffect(() => {
    reload();
    if (admin) listClients().then(setClients).catch(() => setClients([]));
  }, [admin]);

  async function addCredit() {
    const value = Number(amount.replace(",", "."));
    if (!nf.trim() || clientName.trim().length < 2 || !(value > 0)) {
      toast.error("Informe a NF geradora, o cliente e o valor.");
      return;
    }
    setBusy(true);
    try {
      await addExternalCredit({ data: { nfNumber: nf.trim(), clientName: clientName.trim(), amount: value } });
      setNf("");
      setClientName("");
      setAmount("");
      toast.success("Crédito de outra fonte acrescentado.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível acrescentar o crédito.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Créditos HubGov"
        description="Pedidos de governo geram crédito a partir de 8% sobre o valor de lista. O saldo pode ser usado em pedidos futuros, com a NF de origem."
      />
      {admin ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Crédito de outra fonte</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <Field label="NF geradora">
              <Input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="Número da nota" />
            </Field>
            <Field label="Cliente">
              <Input
                value={clientName}
                list="credito-clientes"
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome do cliente"
              />
              <datalist id="credito-clientes">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Valor (R$)">
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button type="button" disabled={busy} onClick={addCredit}>
                Acrescentar crédito
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Gerado</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{brl(summary?.generated ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Utilizado</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{brl(summary?.used ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{brl(summary?.remaining ?? 0)}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">Nenhum movimento de crédito ainda.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 font-medium">NF</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">{formatDateBR(r.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={r.kind === "generated" ? "ok" : "warn"}>
                        {r.source === "inicial"
                          ? "Saldo inicial"
                          : r.source === "externa"
                            ? "Outra fonte"
                            : r.kind === "generated"
                              ? "Gerado"
                              : "Utilizado"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{r.nfNumber || "—"}</td>
                    <td className="px-3 py-3">{r.clientName || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{brl(r.amount)}</td>
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
