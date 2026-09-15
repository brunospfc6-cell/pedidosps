import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  assignPendingUser,
  createUserAccount,
  listUsers,
  resetUserPassword,
  updateUser,
} from "@/lib/server/users";
import { useProfile } from "@/lib/profile-context";
import type { Role } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_app/usuarios")({ component: UsuariosPage });

function UsuariosPage() {
  const profile = useProfile();
  const [data, setData] = useState<Awaited<ReturnType<typeof listUsers>> | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("vendedor");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [resetFor, setResetFor] = useState<{ userId: string; email: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    listUsers().then(setData).catch(() => setData(null));
  }

  useEffect(() => {
    reload();
  }, []);

  if (profile.role !== "administrador") {
    return <p className="text-sm text-muted-foreground">Acesso restrito ao administrador.</p>;
  }

  async function create() {
    if (password !== passwordConfirm) {
      toast.error("A confirmação da senha não confere.");
      return;
    }
    setBusy(true);
    try {
      const res = await createUserAccount({ data: { name, email, role, password } });
      setCreated({ email: res.email, password: res.password });
      setName("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      toast.success("Usuário criado com a senha definida.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar");
    } finally {
      setBusy(false);
    }
  }

  async function saveReset() {
    if (!resetFor) return;
    if (resetPassword !== resetConfirm) {
      toast.error("A confirmação da senha não confere.");
      return;
    }
    setBusy(true);
    try {
      const res = await resetUserPassword({
        data: { userId: resetFor.userId, password: resetPassword },
      });
      setCreated({ email: resetFor.email, password: res.password });
      setResetFor(null);
      setResetPassword("");
      setResetConfirm("");
      toast.success("Senha atualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao definir senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Defina o login e a senha de cada vendedor, diretor ou administrador."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Novo Usuário</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail (Login)">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Perfil">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="vendedor">Vendedor</option>
              <option value="diretor">Diretor</option>
              <option value="administrador">Administrador</option>
            </Select>
          </Field>
          <Field label="Senha" hint="Mínimo de 6 caracteres. Você escolhe a senha deste usuário.">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirmar Senha">
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={create} disabled={busy} className="w-full">
              Criar Usuário
            </Button>
          </div>
        </CardContent>
      </Card>
      {created ? (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-5 text-sm">
            <p className="font-medium">Acesso Definido</p>
            <p className="mt-2 font-mono">Login: {created.email}</p>
            <p className="font-mono">Senha: {created.password}</p>
          </CardContent>
        </Card>
      ) : null}

      {resetFor ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Definir Senha de {resetFor.email}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nova Senha">
              <Input
                type="password"
                autoComplete="new-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirmar Nova Senha">
              <Input
                type="password"
                autoComplete="new-password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="button" onClick={saveReset} disabled={busy}>
                Salvar Senha
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResetFor(null);
                  setResetPassword("");
                  setResetConfirm("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data?.pending.length ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Acessos Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.pending.map((p) => (
              <div key={p.userId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                <div>
                  <p className="text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex gap-2">
                  {(["vendedor", "diretor", "administrador"] as Role[]).map((r) => (
                    <Button
                      key={r}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await assignPendingUser({ data: { userId: p.userId, role: r } });
                        toast.success("Perfil atribuído.");
                        reload();
                      }}
                    >
                      {ROLE_LABEL[r]}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 font-medium">Login</th>
                <th className="px-3 py-3 font-medium">Perfil</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(data?.users ?? []).map((u) => (
                <tr key={u.userId} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">{u.name}</td>
                  <td className="px-3 py-3">{u.email}</td>
                  <td className="px-3 py-3">{ROLE_LABEL[u.role]}</td>
                  <td className="px-3 py-3">
                    <Badge variant={u.active ? "ok" : "danger"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await updateUser({
                            data: {
                              userId: u.userId,
                              name: u.name,
                              role: u.role,
                              active: !u.active,
                            },
                          });
                          reload();
                        }}
                      >
                        {u.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResetFor({ userId: u.userId, email: u.email });
                          setResetPassword("");
                          setResetConfirm("");
                        }}
                      >
                        Definir Senha
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
