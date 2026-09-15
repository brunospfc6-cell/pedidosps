import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { ConfirmSendOdc } from "@/components/confirm-send-odc";
import { ProductPicker } from "@/components/product-picker";
import { SignatureField } from "@/components/signature-field";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { computeOdc } from "@/lib/calc";
import { DEFAULT_HUBGOV_PCT, MIN_NET_BRL } from "@/lib/company";
import { availableCredits, findClientByCsn, listProducts, listSuppliers } from "@/lib/server/catalog";
import { previewNextOdc, savePurchaseOrder } from "@/lib/server/orders";
import type { ClientType, LicenseDelivery, Product, PurchaseOrder, SaleKind, Supplier } from "@/lib/types";
import { SALE_KIND_LABEL } from "@/lib/types";
import { brl, todayISO, usd } from "@/lib/utils";

type Item = {
  productId: number | null;
  productName: string;
  sku: string;
  qty: number;
  listPriceUsd: number;
};

type FormState = {
  orderDate: string;
  supplierId: number;
  saleKind: SaleKind;
  dollarRate: number;
  discountPct: number;
  hubgovCreditPct: number;
  licenseDelivery: LicenseDelivery;
  activationDate: string;
  paymentTermDays: number;
  creditUsed: number;
  creditNf: string;
  specialCondition: string;
  specialApprovedBy: string;
  clientCsn: string;
  clientName: string;
  clientDocument: string;
  clientEmail: string;
  clientManager: string;
  clientPhone: string;
  renewalContracts: string;
  notes: string;
  items: Item[];
};

const emptyItem = (): Item => ({
  productId: null,
  productName: "",
  sku: "",
  qty: 1,
  listPriceUsd: 0,
});

function fromOrder(o: PurchaseOrder): FormState {
  return {
    orderDate: o.orderDate,
    supplierId: o.supplierId,
    saleKind: o.saleKind,
    dollarRate: o.dollarRate,
    discountPct: o.discountPct,
    hubgovCreditPct: o.hubgovCreditPct || DEFAULT_HUBGOV_PCT,
    licenseDelivery: o.licenseDelivery,
    activationDate: o.activationDate ?? "",
    paymentTermDays: o.paymentTermDays,
    creditUsed: o.creditUsed,
    creditNf: o.creditNf ?? "",
    specialCondition: o.specialCondition ?? "",
    specialApprovedBy: o.specialApprovedBy ?? "",
    clientCsn: o.clientCsn ?? "",
    clientName: o.clientName ?? "",
    clientDocument: o.clientDocument ?? "",
    clientEmail: o.clientEmail ?? "",
    clientManager: o.clientManager ?? "",
    clientPhone: o.clientPhone ?? "",
    renewalContracts: o.renewalContracts ?? "",
    notes: o.notes ?? "",
    items: o.items.length
      ? o.items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          qty: it.qty,
          listPriceUsd: it.listPriceUsd,
        }))
      : [emptyItem()],
  };
}

export function OdcForm({
  existing,
  locked,
  defaultClientType,
  onUpdated,
}: {
  existing?: PurchaseOrder;
  locked?: boolean;
  defaultClientType?: ClientType;
  onUpdated?: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [clientType, setClientType] = useState<ClientType | null>(
    existing?.clientType ?? defaultClientType ?? null,
  );
  const [showDiscount, setShowDiscount] = useState((existing?.discountPct ?? 0) > 0);
  const [showCreditUse, setShowCreditUse] = useState((existing?.creditUsed ?? 0) > 0);
  const [showHubgov, setShowHubgov] = useState((existing?.hubgovCreditPct ?? 0) > 0);
  const [showSpecial, setShowSpecial] = useState(Boolean(existing?.specialCondition));
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [nextNumber, setNextNumber] = useState(existing?.number ?? "…");
  const [credits, setCredits] = useState<{ nf: string; remaining: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(
    existing
      ? fromOrder(existing)
      : {
          orderDate: todayISO(),
          supplierId: 0,
          saleKind: "nova",
          dollarRate: 0,
          discountPct: 0,
          hubgovCreditPct: DEFAULT_HUBGOV_PCT,
          licenseDelivery: "imediato",
          activationDate: "",
          paymentTermDays: 30,
          creditUsed: 0,
          creditNf: "",
          specialCondition: "",
          specialApprovedBy: "",
          clientCsn: "",
          clientName: "",
          clientDocument: "",
          clientEmail: "",
          clientManager: "",
          clientPhone: "",
          renewalContracts: "",
          notes: "",
          items: [emptyItem()],
        },
  );

  useEffect(() => {
    listProducts().then(setProducts).catch(() => setProducts([]));
    listSuppliers().then((s) => {
      setSuppliers(s);
      setForm((f) => (f.supplierId ? f : { ...f, supplierId: s[0]?.id ?? 0 }));
    });
    availableCredits().then(setCredits).catch(() => setCredits([]));
    if (!existing) previewNextOdc().then((r) => setNextNumber(r.number)).catch(() => {});
  }, [existing]);

  const calc = useMemo(
    () =>
      computeOdc({
        items: form.items,
        dollarRate: form.dollarRate,
        discountPct: showDiscount ? form.discountPct : 0,
        clientType: clientType ?? "privado",
        hubgovCreditPct: clientType === "governo" && showHubgov ? form.hubgovCreditPct : 0,
        creditUsed: showCreditUse ? form.creditUsed : 0,
      }),
    [form, clientType, showDiscount, showHubgov, showCreditUse],
  );

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function setItem(index: number, p: Partial<Item>) {
    setForm((f) => {
      const items = f.items.map((it, i) => (i === index ? { ...it, ...p } : it));
      return { ...f, items };
    });
  }

  async function lookupCsn() {
    const csn = form.clientCsn.trim();
    if (!csn) return;
    try {
      const client = await findClientByCsn({ data: { csn } });
      if (client) {
        patch({
          clientName: client.name,
          clientDocument: client.document,
          clientEmail: client.email ?? "",
          clientManager: client.managerName ?? "",
          clientPhone: client.phone ?? "",
        });
        toast.success("Cliente encontrado — dados preenchidos.");
      }
    } catch {
      /* ignore */
    }
  }

  async function submit(finalize: boolean) {
    if (!clientType) {
      toast.error("Escolha se o cliente é Governo ou Privado.");
      return;
    }
    setSaving(true);
    try {
      const result = await savePurchaseOrder({
        data: {
          id: existing?.id,
          orderDate: form.orderDate,
          supplierId: form.supplierId,
          clientType,
          saleKind: form.saleKind,
          dollarRate: form.dollarRate,
          discountPct: showDiscount ? form.discountPct : 0,
          hubgovCreditPct: clientType === "governo" && showHubgov ? form.hubgovCreditPct : 0,
          licenseDelivery: form.licenseDelivery,
          activationDate: form.activationDate || null,
          paymentTermDays: form.paymentTermDays,
          creditUsed: showCreditUse ? form.creditUsed : 0,
          creditNf: showCreditUse ? form.creditNf : null,
          specialCondition: showSpecial ? form.specialCondition : null,
          specialApprovedBy: showSpecial ? form.specialApprovedBy : null,
          signatureData: null,
          signedName: null,
          clientCsn: form.clientCsn,
          clientName: form.clientName,
          clientDocument: form.clientDocument,
          clientEmail: form.clientEmail,
          clientManager: form.clientManager,
          clientPhone: form.clientPhone,
          renewalContracts: form.saleKind === "renovacao" ? form.renewalContracts : null,
          notes: form.notes,
          finalize,
          items: form.items.filter((it) => it.productName),
        },
      });
      toast.success(finalize ? "Ordem de compra finalizada. Confirme o envio à PARS quando despachar o pedido." : "Rascunho salvo.");
      await onUpdated?.();
      navigate({ to: "/odc/$id", params: { id: String(result.id) } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!clientType) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl tracking-tight">Nova Ordem de Compra</h1>
        <p className="mt-2 text-muted-foreground">
          Antes de começar, informe o tipo de cliente. Somente pedidos de governo geram créditos HubGov.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setClientType("governo")}
            className="rounded-xl border border-border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <p className="font-display text-xl">Governo</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Gera crédito HubGov a partir de 8% sobre o valor de lista.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setClientType("privado")}
            className="rounded-xl border border-border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <p className="font-display text-xl">Privado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Não gera crédito HubGov. Pode utilizar saldo já existente.
            </p>
          </button>
        </div>
      </div>
    );
  }

  const disabled = Boolean(locked);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          {clientType === "governo" ? "Cliente Governo · HubGov Ativo" : "Cliente Privado · Sem Geração HubGov"}
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Ordem de Compra {existing?.number ?? nextNumber}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Dados Básicos</CardTitle>
          <CardDescription>Número sequencial único para todos os vendedores, data e fornecedor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Número do Pedido">
            <Input value={existing?.number ?? nextNumber} disabled />
          </Field>
          <Field label="Data do Pedido">
            <Input
              type="date"
              value={form.orderDate}
              disabled={disabled}
              onChange={(e) => patch({ orderDate: e.target.value })}
            />
          </Field>
          <Field label="Fornecedor">
            <Select
              value={String(form.supplierId)}
              disabled={disabled}
              onChange={(e) => patch({ supplierId: Number(e.target.value) })}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.cnpj}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo da Venda">
            <Select
              value={form.saleKind}
              disabled={disabled}
              onChange={(e) => patch({ saleKind: e.target.value as SaleKind })}
            >
              <option value="nova">{SALE_KIND_LABEL.nova}</option>
              <option value="renovacao">{SALE_KIND_LABEL.renovacao}</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Produtos Autodesk</CardTitle>
          <CardDescription>
            Tabela vigente Setembro 2026 (08/09 a 06/10). Busque pelo SKU ou nome — o preço de lista já vem em dólar + IVA.
          </CardDescription>

        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="w-20 pb-2 font-medium">Qtd</th>
                  <th className="w-32 pb-2 font-medium">Lista USD</th>
                  <th className="w-32 pb-2 font-medium">Total USD</th>
                  <th className="w-12 pb-2" />
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-2">
                      <ProductPicker
                        products={products}
                        value={it.productId}
                        saleKind={form.saleKind}
                        disabled={disabled}
                        onSelect={(p) =>
                          setItem(i, {
                            productId: p.id,
                            productName: p.name,
                            sku: p.sku,
                            listPriceUsd: p.listPriceUsd,
                          })
                        }
                      />
                    </td>

                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min={1}
                        disabled={disabled}
                        value={it.qty}
                        onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{usd(it.listPriceUsd)}</td>
                    <td className="py-2 tabular-nums">{usd(it.qty * it.listPriceUsd)}</td>
                    <td className="py-2">
                      {!disabled && form.items.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))
                          }
                          aria-label="Remover item"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!disabled ? (
            <Button type="button" variant="outline" onClick={() => patch({ items: [...form.items, emptyItem()] })}>
              <Plus className="size-4" /> Adicionar Produto
            </Button>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Dólar do Dia (R$)">
              <Input
                type="number"
                step="0.0001"
                min={0}
                disabled={disabled}
                value={form.dollarRate || ""}
                onChange={(e) => patch({ dollarRate: Number(e.target.value) })}
              />
            </Field>
            <Field label="Prazo de Pagamento (Dias)">
              <Input
                type="number"
                min={0}
                disabled={disabled}
                value={form.paymentTermDays}
                onChange={(e) => patch({ paymentTermDays: Number(e.target.value) })}
              />
            </Field>
            <Field label="Entrega das Licenças">
              <Select
                disabled={disabled}
                value={form.licenseDelivery}
                onChange={(e) => patch({ licenseDelivery: e.target.value as LicenseDelivery })}
              >
                <option value="imediato">Imediato</option>
                <option value="agendada">Escolher Data de Ativação</option>
              </Select>
            </Field>
            {form.licenseDelivery === "agendada" ? (
              <Field label="Data de Ativação">
                <Input
                  type="date"
                  disabled={disabled}
                  value={form.activationDate}
                  onChange={(e) => patch({ activationDate: e.target.value })}
                />
              </Field>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={showDiscount ? "default" : "outline"} disabled={disabled} onClick={() => setShowDiscount((v) => !v)}>
              Desconto
            </Button>
            {clientType === "governo" ? (
              <Button type="button" variant={showHubgov ? "default" : "outline"} disabled={disabled} onClick={() => setShowHubgov((v) => !v)}>
                Crédito HubGov gerado
              </Button>
            ) : null}
            <Button type="button" variant={showCreditUse ? "default" : "outline"} disabled={disabled} onClick={() => setShowCreditUse((v) => !v)}>
              Utilizar crédito HubGov
            </Button>
            <Button type="button" variant={showSpecial ? "default" : "outline"} disabled={disabled} onClick={() => setShowSpecial((v) => !v)}>
              Condição especial
            </Button>
          </div>

          {showDiscount ? (
            <Field label="Percentual de Desconto" className="max-w-xs">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                disabled={disabled}
                value={form.discountPct}
                onChange={(e) => patch({ discountPct: Number(e.target.value) })}
              />
            </Field>
          ) : null}

          {clientType === "governo" && showHubgov ? (
            <Field
              label="Percentual de Crédito HubGov Gerado"
              hint="Calculado sobre o valor de lista em reais. Mínimo 8%."
              className="max-w-xs"
            >
              <Input
                type="number"
                min={8}
                max={100}
                step="0.01"
                disabled={disabled}
                value={form.hubgovCreditPct}
                onChange={(e) => patch({ hubgovCreditPct: Number(e.target.value) })}
              />
            </Field>
          ) : null}

          {showCreditUse ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor do Crédito Utilizado (R$)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={disabled}
                  value={form.creditUsed || ""}
                  onChange={(e) => patch({ creditUsed: Number(e.target.value) })}
                />
              </Field>
              <Field label="NF que Gerou Este Crédito" hint="Obrigatório ao utilizar crédito.">
                {credits.length ? (
                  <Select
                    disabled={disabled}
                    value={form.creditNf}
                    onChange={(e) => {
                      const found = credits.find((c) => c.nf === e.target.value);
                      patch({
                        creditNf: e.target.value,
                        creditUsed: found && !form.creditUsed ? found.remaining : form.creditUsed,
                      });
                    }}
                  >
                    <option value="">Selecionar NF com Saldo</option>
                    {credits.map((c) => (
                      <option key={c.nf} value={c.nf}>
                        {c.nf} · saldo {brl(c.remaining)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    disabled={disabled}
                    value={form.creditNf}
                    onChange={(e) => patch({ creditNf: e.target.value })}
                    placeholder="Número da NF"
                  />
                )}
              </Field>
            </div>
          ) : null}

          {showSpecial ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Condição Especial">
                <Textarea
                  disabled={disabled}
                  value={form.specialCondition}
                  onChange={(e) => patch({ specialCondition: e.target.value })}
                />
              </Field>
              <Field label="Quem Aprovou">
                <Input
                  disabled={disabled}
                  value={form.specialApprovedBy}
                  onChange={(e) => patch({ specialApprovedBy: e.target.value })}
                />
              </Field>
            </div>
          ) : null}

          <div className="rounded-lg bg-muted/60 p-4 text-sm">
            <p>Lista: {usd(calc.listTotalUsd)} → {brl(calc.listTotalBrl)}</p>
            <p>Desconto: − {brl(calc.discountAmount)}</p>
            {clientType === "governo" ? <p>Crédito HubGov gerado: {brl(calc.creditGenerated)}</p> : null}
            <p>Crédito utilizado: {brl(showCreditUse ? form.creditUsed : 0)}</p>
            <p className="mt-2 font-medium">Líquido: {brl(calc.netTotalBrl)}</p>
            {calc.belowMinimum ? (
              <p className="mt-1 text-destructive">
                O valor da venda não pode ser inferior a {brl(MIN_NET_BRL)} ao utilizar crédito.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Dados do Cliente</CardTitle>
          <CardDescription>
            Informe o CSN. Se já existir na base, os demais campos são preenchidos automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="CSN">
            <Input
              disabled={disabled}
              value={form.clientCsn}
              onChange={(e) => patch({ clientCsn: e.target.value })}
              onBlur={lookupCsn}
            />
          </Field>
          <Field label="Nome">
            <Input disabled={disabled} value={form.clientName} onChange={(e) => patch({ clientName: e.target.value })} />
          </Field>
          <Field label="CNPJ / CPF">
            <Input
              disabled={disabled}
              value={form.clientDocument}
              onChange={(e) => patch({ clientDocument: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              disabled={disabled}
              value={form.clientEmail}
              onChange={(e) => patch({ clientEmail: e.target.value })}
            />
          </Field>
          <Field label="Nome do Gestor">
            <Input
              disabled={disabled}
              value={form.clientManager}
              onChange={(e) => patch({ clientManager: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <Input disabled={disabled} value={form.clientPhone} onChange={(e) => patch({ clientPhone: e.target.value })} />
          </Field>
          {form.saleKind === "renovacao" ? (
            <Field
              label="Contratos Renovados"
              hint="Pode haver mais de um contrato no mesmo pedido. Separe por vírgula."
              className="sm:col-span-2"
            >
              <Textarea
                disabled={disabled}
                value={form.renewalContracts}
                onChange={(e) => patch({ renewalContracts: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Observações" className="sm:col-span-2">
            <Textarea disabled={disabled} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturamento e Cobrança</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Pro-Systems Informática LTDA</p>
          <p>SRTV/Sul Quadra 701, Palácio do Rádio I, S/N SL 209</p>
          <p>CEP 70.340-901 — Brasília/DF</p>
          <p>CNPJ: 03.620.200/0001-35 · Inscrição Estadual: 0731060800113</p>
          <p>Fone: 61-3202.2666</p>
        </CardContent>
      </Card>

      <SignatureField />

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2 pb-8">
          {existing?.status === "pendente_envio" ? (
            <>
              <Button type="button" variant="outline" disabled={saving} onClick={() => submit(true)}>
                Salvar Alterações
              </Button>
              <ConfirmSendOdc
                orderId={existing.id}
                orderNumber={existing.number}
                onSent={onUpdated}
              />
              <Button asChild variant="secondary">
                <Link to="/vendas/nova" search={{ odc: existing.id }}>
                  Ir para Pedido de Venda
                </Link>
              </Button>
              <ConfirmCancel
                kind="odc"
                orderId={existing.id}
                orderNumber={existing.number}
                onCancelled={onUpdated}
              />
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={saving} onClick={() => submit(false)}>
                Salvar Rascunho
              </Button>
              <Button type="button" disabled={saving || calc.belowMinimum} onClick={() => submit(true)}>
                Finalizar
              </Button>
              {existing ? (
                <ConfirmCancel
                  kind="odc"
                  orderId={existing.id}
                  orderNumber={existing.number}
                  onCancelled={onUpdated}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
