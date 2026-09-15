import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { ConfirmSendOdc } from "@/components/confirm-send-odc";
import { SignatureField } from "@/components/signature-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { buildMemo, computeOdc } from "@/lib/calc";
import { listTeam } from "@/lib/server/profile";
import { getPurchaseOrder, saveSalesOrder } from "@/lib/server/orders";
import type { ClientType, Profile, PurchaseOrder, SalesOrder } from "@/lib/types";
import { brl, todayISO } from "@/lib/utils";

type SaleItem = {
  productName: string;
  sku: string;
  qty: number;
  unitPriceBrl: number;
};

export function SalesForm({
  odcId,
  existing,
  profile,
  locked: lockedProp,
  onUpdated,
}: {
  odcId: number;
  existing?: SalesOrder;
  profile: Profile;
  locked?: boolean;
  onUpdated?: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [odc, setOdc] = useState<PurchaseOrder | null>(null);
  const [team, setTeam] = useState<{ userId: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [clientType, setClientType] = useState<ClientType>(existing?.clientType ?? "privado");
  const [orderDate, setOrderDate] = useState(existing?.orderDate ?? todayISO());
  const [contractNumber, setContractNumber] = useState(existing?.contractNumber ?? "");
  const [proposalNumber, setProposalNumber] = useState(existing?.proposalNumber ?? "");
  const [acceptanceDate, setAcceptanceDate] = useState(existing?.acceptanceDate ?? "");
  const [marginPct, setMarginPct] = useState(existing?.marginPct ?? 0);
  const [sellerId, setSellerId] = useState(existing?.sellerId ?? profile.userId);
  const [financeName, setFinanceName] = useState(existing?.financeContactName ?? "");
  const [financeContact, setFinanceContact] = useState(existing?.financeContact ?? "");
  const [paymentTermDays, setPaymentTermDays] = useState(
    existing?.paymentTermDays ?? 30,
  );
  const [items, setItems] = useState<SaleItem[]>(existing?.items ?? []);

  useEffect(() => {
    getPurchaseOrder({ data: { id: odcId } })
      .then((o) => {
        setOdc(o);
        setClientType((t) => existing?.clientType ?? o.clientType);
        setPaymentTermDays((d) => existing?.paymentTermDays ?? o.paymentTermDays);
        if (!existing) {
          setItems(
            o.items.map((it) => ({
              productName: it.productName,
              sku: it.sku,
              qty: it.qty,
              unitPriceBrl: 0,
            })),
          );
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "ODC não encontrada"));
    listTeam().then(setTeam).catch(() => setTeam([]));
  }, [odcId, existing]);

  const memo = useMemo(() => {
    if (!odc) return "";
    const calc = computeOdc({
      items: odc.items,
      dollarRate: odc.dollarRate,
      discountPct: odc.discountPct,
      clientType: odc.clientType,
      hubgovCreditPct: odc.hubgovCreditPct,
      creditUsed: odc.creditUsed,
    });
    return buildMemo({
      items: odc.items,
      dollarRate: odc.dollarRate,
      discountPct: odc.discountPct,
      clientType: odc.clientType,
      hubgovCreditPct: odc.hubgovCreditPct,
      creditUsed: odc.creditUsed,
      ...calc,
    });
  }, [odc]);

  const sellerOptions =
    team.length > 0 ? team : [{ userId: profile.userId, name: profile.name }];
  const sellerName = sellerOptions.find((t) => t.userId === sellerId)?.name ?? profile.name;
  const saleTotal = items.reduce((acc, it) => acc + it.qty * it.unitPriceBrl, 0);

  async function submit() {
    if (!odc) return;
    setSaving(true);
    try {
      const result = await saveSalesOrder({
        data: {
          id: existing?.id,
          purchaseOrderId: odc.id,
          orderDate,
          clientType,
          contractNumber: clientType === "governo" ? contractNumber : null,
          proposalNumber: clientType === "privado" ? proposalNumber : null,
          acceptanceDate: clientType === "privado" ? acceptanceDate : null,
          marginPct,
          sellerId,
          sellerName,
          financeContactName: financeName,
          financeContact,
          paymentTermDays,
          items,
        },
      });
      toast.success("Pedido de venda salvo.");
      navigate({ to: "/vendas/$id", params: { id: String(result.id) } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!odc) {
    return <p className="text-sm text-muted-foreground">Carregando ordem de compra…</p>;
  }

  const locked =
    Boolean(lockedProp) ||
    existing?.status === "cancelado" ||
    odc.status === "cancelado";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          A partir da {odc.number}
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">
          {existing ? `Pedido de Venda ${existing.number}` : "Novo Pedido de Venda"}
        </h1>
      </div>

      {odc.status === "cancelado" ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Ordem de Compra Cancelada</CardTitle>
            <CardDescription>
              A {odc.number} foi cancelada. Não é possível gerar ou alterar o pedido de venda.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {odc.status === "pendente_envio" ? (
        <Card className="border-warn/40 bg-accent">
          <CardHeader>
            <CardTitle>Confirmar Envio da {odc.number}</CardTitle>
            <CardDescription>
              A ordem de compra ainda está pendente. Confirme o envio à PARS quando o pedido for despachado — depois disso ela não poderá ser alterada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmSendOdc
              orderId={odc.id}
              orderNumber={odc.number}
              onSent={async () => {
                const fresh = await getPurchaseOrder({ data: { id: odc.id } });
                setOdc(fresh);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
          <CardDescription>Dados puxados da ordem de compra.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">CSN · </span>{odc.clientCsn}</p>
          <p><span className="text-muted-foreground">Nome · </span>{odc.clientName}</p>
          <p><span className="text-muted-foreground">CNPJ/CPF · </span>{odc.clientDocument}</p>
          <p><span className="text-muted-foreground">Gestor · </span>{odc.clientManager || "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memória de Cálculo</CardTitle>
          <CardDescription>Gerada automaticamente a partir da ordem de compra.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">{memo}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Venda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo de Cliente">
              <Select value={clientType} disabled={locked} onChange={(e) => setClientType(e.target.value as ClientType)}>
                <option value="governo">Governo</option>
                <option value="privado">Privado</option>
              </Select>
            </Field>
            <Field label="Data">
              <Input type="date" disabled={locked} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </Field>
            {clientType === "governo" ? (
              <Field label="Nº do Contrato Administrativo">
                <Input disabled={locked} value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
              </Field>
            ) : (
              <>
                <Field label="Nº da Proposta">
                  <Input disabled={locked} value={proposalNumber} onChange={(e) => setProposalNumber(e.target.value)} />
                </Field>
                <Field label="Data do Aceite">
                  <Input type="date" disabled={locked} value={acceptanceDate} onChange={(e) => setAcceptanceDate(e.target.value)} />
                </Field>
              </>
            )}
            <Field label="Margem Utilizada (%)">
              <Input
                type="number"
                step="0.01"
                disabled={locked}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
              />
            </Field>
            <Field label="Vendedor">
              <Select value={sellerId} disabled={locked} onChange={(e) => setSellerId(e.target.value)}>
                {sellerOptions.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prazo de Pagamento (Dias)">
              <Input
                type="number"
                min={0}
                disabled={locked}
                value={paymentTermDays}
                onChange={(e) => setPaymentTermDays(Number(e.target.value))}
              />
            </Field>
            <Field
              label="Nome de Contato (Interno)"
              hint="Para o departamento financeiro falar com o cliente."
            >
              <Input disabled={locked} value={financeName} onChange={(e) => setFinanceName(e.target.value)} />
            </Field>
            <Field label="Telefone / E-mail de Contato (Interno)">
              <Input disabled={locked} value={financeContact} onChange={(e) => setFinanceContact(e.target.value)} />
            </Field>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="w-20 pb-2 font-medium">Qtd</th>
                  <th className="w-40 pb-2 font-medium">Valor Unitário (R$)</th>
                  <th className="w-32 pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-2">{it.productName}</td>
                    <td className="py-2 tabular-nums">{it.qty}</td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={locked}
                        value={it.unitPriceBrl || ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setItems((arr) => arr.map((x, j) => (j === i ? { ...x, unitPriceBrl: v } : x)));
                        }}
                      />
                    </td>
                    <td className="py-2 tabular-nums">{brl(it.qty * it.unitPriceBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg bg-muted/60 p-4 text-sm">
            <p>Crédito utilizado nesta venda: {brl(odc.creditUsed)}</p>
            <p>Crédito HubGov gerado nesta venda: {brl(odc.creditGenerated)}</p>
            <p className="mt-2 font-medium">Total da Venda: {brl(saleTotal)}</p>
          </div>
        </CardContent>
      </Card>

      <SignatureField />

      <div className="flex flex-wrap items-center gap-2 pb-8">
        {!locked ? (
          <Button type="button" disabled={saving} onClick={submit}>
            Salvar Pedido de Venda
          </Button>
        ) : null}
        {existing && existing.status !== "cancelado" ? (
          <ConfirmCancel
            kind="venda"
            orderId={existing.id}
            orderNumber={existing.number}
            onCancelled={onUpdated}
          />
        ) : null}
      </div>
    </div>
  );
}
