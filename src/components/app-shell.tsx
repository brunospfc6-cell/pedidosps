import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  Coins,
  LayoutDashboard,
  Package,
  PanelLeft,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import type { Profile } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { BrandLogo } from "./brand-logo";
import { Button } from "./ui/button";

const NAV = [
  { to: "/", label: "Início", icon: LayoutDashboard, roles: ["administrador", "vendedor", "diretor"] },
  { to: "/odc", label: "Ordens de Compra", icon: ShoppingCart, roles: ["administrador", "vendedor", "diretor"] },
  { to: "/vendas", label: "Pedidos de Venda", icon: Wallet, roles: ["administrador", "vendedor", "diretor"] },
  { to: "/clientes", label: "Clientes", icon: Building2, roles: ["administrador", "vendedor", "diretor"] },
  { to: "/creditos", label: "HubGov", icon: Coins, roles: ["administrador", "vendedor", "diretor"] },
  { to: "/produtos", label: "Produtos e Preços", icon: Package, roles: ["administrador"] },
  { to: "/usuarios", label: "Usuários", icon: Users, roles: ["administrador"] },
  { to: "/gestao", label: "Gestão e Análise", icon: BarChart3, roles: ["administrador", "diretor"] },
] as const;

export function AppShell({ profile }: { profile: Profile }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => (n.roles as readonly string[]).includes(profile.role));

  return (
    <div className="flex min-h-screen bg-background">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-foreground/30 md:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="px-4 py-5">
          <div className="rounded-md bg-white px-2.5 py-2">
            <BrandLogo className="h-10 max-w-[196px]" />
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
          {items.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  active
                    ? "bg-white/10 text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/8 px-4 py-4">
          <p className="truncate text-sm">{profile.name}</p>
          <p className="text-[11px] text-sidebar-muted">{ROLE_LABEL[profile.role]}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <PanelLeft className="size-5" />
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:block">
              Controle de Compras e Vendas
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="muted">{ROLE_LABEL[profile.role]}</Badge>
            <UserButton />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
