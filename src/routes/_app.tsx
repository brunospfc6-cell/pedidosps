import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BrandLogo } from "@/components/brand-logo";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ProfileContext } from "@/lib/profile-context";
import { getMyProfile } from "@/lib/server/profile";
import type { Profile } from "@/lib/types";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setReady(true);
      return;
    }
    getMyProfile()
      .then((res) => {
        if (res.ok) setProfile(res.profile);
        else setDenied(res.message);
      })
      .catch(() => setDenied("Não foi possível carregar o perfil."))
      .finally(() => setReady(true));
  }, [user, isPending]);

  if (isPending || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;

  if (denied || !profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <BrandLogo className="h-10 max-w-[200px]" />
        <h1 className="font-display text-2xl">Acesso Pendente</h1>
        <p className="text-sm text-muted-foreground">
          {denied ?? "Peça ao administrador da Pro-Systems para cadastrar seu usuário."}
        </p>
        <UserButton />
      </main>
    );
  }

  return (
    <ProfileContext.Provider value={profile}>
      <AppShell profile={profile} />
    </ProfileContext.Provider>
  );
}
