import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { COMPANY } from "@/lib/company";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: err } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/",
      });
      if (err) setError(err.message ?? "Não foi possível entrar.");
      else window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="w-fit rounded-md bg-white px-3 py-2">
          <BrandLogo className="h-11 max-w-[220px]" />
        </div>
        <div>
          <p className="font-display text-4xl leading-tight tracking-tight">
            Controle de Compras
            <br />e Vendas Autodesk.
          </p>
          <p className="mt-4 max-w-sm text-sm text-sidebar-muted">
            Ordens de compra, pedidos de venda, créditos HubGov e gestão comercial da revenda autorizada.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">
          {COMPANY.name} · CNPJ {COMPANY.cnpj} · Brasília/DF
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <BrandLogo className="h-10 max-w-[200px] lg:hidden" />
          <div>
            <p className="text-xs text-muted-foreground">Acesso</p>
            <h1 className="mt-1 font-display text-3xl">Entrar</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use o login gerado pelo administrador ou continue com sua conta.
            </p>
          </div>
          {authEnabled ? (
            <>
              <form className="space-y-3" onSubmit={onEmail}>
                <Field label="E-mail / Login">
                  <Input
                    type="email"
                    autoComplete="username"
                    placeholder="olivia.t@example.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Senha">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Senha definida pelo administrador"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={pending}>
                  Entrar
                </Button>
              </form>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                  >
                    Continuar com {p.label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">O acesso está desativado.</p>
          )}
        </div>
      </section>
    </main>
  );
}
