import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { listClients, upsertClient } from "@/lib/server/catalog";
import type { Client } from "@/lib/types";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<Partial<Client> | null>(null);

  function reload() {
    listClients().then(setClients).catch(() => setClients([]));
  }

  useEffect(() => {
    reload();
  }, []);

  async function save() {
    if (!form?.csn || !form.name || !form.document) {
      toast.error("CSN, nome e CNPJ/CPF são obrigatórios.");
      return;
    }
    try {
      await upsertClient({
        data: {
          csn: form.csn,
          name: form.name,
          document: form.document,
          email: form.email,
          managerName: form.managerName,
          phone: form.phone,
        },
      });
      toast.success("Cliente salvo.");
      setForm(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro reutilizado nas ordens de compra. O CSN identifica o cliente e completa os demais dados."
        actions={
          <Button type="button" onClick={() => setForm({})}>
            Novo Cliente
          </Button>
        }
      />
      {form ? (
        <Card className="mb-6">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="CSN">
              <Input value={form.csn ?? ""} onChange={(e) => setForm({ ...form, csn: e.target.value })} />
            </Field>
            <Field label="Nome">
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="CNPJ / CPF">
              <Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Gestor">
              <Input
                value={form.managerName ?? ""}
                onChange={(e) => setForm({ ...form, managerName: e.target.value })}
              />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" onClick={save}>
                Salvar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {clients.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">CSN</th>
                  <th className="px-3 py-3 font-medium">Nome</th>
                  <th className="px-3 py-3 font-medium">Documento</th>
                  <th className="px-3 py-3 font-medium">Gestor</th>
                  <th className="px-5 py-3 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{c.csn}</td>
                    <td className="px-3 py-3">{c.name}</td>
                    <td className="px-3 py-3">{c.document}</td>
                    <td className="px-3 py-3">{c.managerName || "—"}</td>
                    <td className="px-5 py-3">{c.email || c.phone || "—"}</td>
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
