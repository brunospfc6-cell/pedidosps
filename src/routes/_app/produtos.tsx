import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listProducts, saveProduct } from "@/lib/server/catalog";
import { useProfile } from "@/lib/profile-context";
import type { Product } from "@/lib/types";
import {
  LICENSE_LABEL,
  PRICE_LIST_INFO,
  TERM_LABEL,
  USAGE_LABEL,
} from "@/lib/types";
import { usd } from "@/lib/utils";

export const Route = createFileRoute("/_app/produtos")({ component: ProdutosPage });

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function ProdutosPage() {
  const profile = useProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("todos");
  const [term, setTerm] = useState("todos");
  const [license, setLicense] = useState("todos");
  const [usage, setUsage] = useState("Commercial");

  function reload() {
    setLoading(true);
    listProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }


  useEffect(() => {
    reload();
  }, []);

  const groups = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [products],
  );
  const terms = useMemo(
    () => [...new Set(products.map((p) => p.contractTerm).filter(Boolean))],
    [products],
  );
  const licenses = useMemo(
    () => [...new Set(products.map((p) => p.licenseType).filter(Boolean))],
    [products],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return products.filter((p) => {
      if (group !== "todos" && p.category !== group) return false;
      if (term !== "todos" && p.contractTerm !== term) return false;
      if (license !== "todos" && p.licenseType !== license) return false;
      if (usage !== "todos" && p.usageType !== usage) return false;
      if (!q) return true;
      return normalize(`${p.name} ${p.sku} ${p.productLine} ${p.sapName}`).includes(q);
    });
  }, [products, query, group, term, license, usage]);

  if (profile.role !== "administrador") {
    return <p className="text-sm text-muted-foreground">Acesso restrito ao administrador.</p>;
  }

  async function save() {
    if (!editing?.sku || !editing.name || editing.listPriceUsd == null || Number.isNaN(Number(editing.listPriceUsd))) {
      toast.error("Preencha SKU, nome e preço.");
      return;
    }
    try {
      await saveProduct({
        data: {
          id: editing.id,
          sku: editing.sku,
          name: editing.name,
          category: editing.category || "Autodesk",
          listPriceUsd: Number(editing.listPriceUsd),
          active: editing.active ?? true,
        },
      });
      toast.success("Produto salvo.");
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Produtos e Preços"
        description={`Planilha Autodesk ${PRICE_LIST_INFO.label} — vigente de 08/09/2026 a 06/10/2026. Preço reseller USD + IVA.`}
        actions={
          <Button type="button" onClick={() => setEditing({ category: "Autodesk", active: true, listPriceUsd: 0 })}>
            Novo Produto
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Buscar" className="lg:col-span-2">
          <Input
            value={query}
            placeholder="SKU, nome ou linha…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Field label="Família">
          <Select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="todos">Todas</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prazo">
          <Select value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="todos">Todos</option>
            {terms.map((t) => (
              <option key={t} value={t}>
                {TERM_LABEL[t] ?? t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={license} onChange={(e) => setLicense(e.target.value)}>
            <option value="todos">Todos</option>
            {licenses.map((l) => (
              <option key={l} value={l}>
                {LICENSE_LABEL[l] ?? l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["Commercial", "Not For Resale", "todos"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setUsage(key)}
            className={
              usage === key
                ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                : "rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
            }
          >
            {key === "todos" ? "Todos" : (USAGE_LABEL[key] ?? key)}
          </button>
        ))}
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {products.length} SKUs
        </p>
      </div>

      {editing ? (
        <Card className="mb-6">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="SKU">
              <Input value={editing.sku ?? ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} />
            </Field>
            <Field label="Nome" className="sm:col-span-2">
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Família">
              <Input
                value={editing.category ?? ""}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
            </Field>
            <Field label="Preço Reseller USD + IVA">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={editing.listPriceUsd ?? 0}
                onChange={(e) => setEditing({ ...editing, listPriceUsd: Number(e.target.value) })}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="button" onClick={save}>
                Salvar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-3 py-3 font-medium">Produto</th>
                <th className="px-3 py-3 font-medium">Prazo</th>
                <th className="px-3 py-3 font-medium">Tipo</th>
                <th className="px-3 py-3 text-right font-medium">Lista USD</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">{p.sku}</td>
                  <td className="px-3 py-3">
                    <p className="leading-snug">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.productLine}
                      {p.category ? ` · ${p.category}` : ""}
                      {p.usageType === "Not For Resale" ? " · NFR" : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{(TERM_LABEL[p.contractTerm] ?? p.contractTerm) || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{(LICENSE_LABEL[p.licenseType] ?? p.licenseType) || "—"}</td>

                  <td className="px-3 py-3 text-right tabular-nums">{usd(p.listPriceUsd)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Carregando tabela Autodesk…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Nenhum SKU com esses filtros.
                  </td>
                </tr>
              ) : null}

            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
