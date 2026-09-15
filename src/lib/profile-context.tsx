import { createContext, useContext } from "react";
import type { Profile } from "./types";

export const ProfileContext = createContext<Profile | null>(null);

export function useProfile() {
  const p = useContext(ProfileContext);
  if (!p) throw new Error("Perfil não disponível");
  return p;
}
