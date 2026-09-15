import { getSql } from "@/lib/db";
import type { Profile, Role } from "@/lib/types";

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type ProfileRow = {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export async function requireProfile(userId: string): Promise<Profile> {
  const sql = await getSql();
  const existing = await sql<ProfileRow>`
    select user_id, name, email, role, active from profiles where user_id = ${userId}
  `;
  if (existing[0]) {
    if (!existing[0].active) {
      throw new AppError("Conta desativada. Contate o administrador.", 403);
    }
    return {
      userId: existing[0].user_id,
      name: existing[0].name,
      email: existing[0].email,
      role: existing[0].role,
      active: true,
    };
  }

  const countRows = await sql<{ n: number | string }>`select count(*)::int as n from profiles`;
  const n = Number(countRows[0]?.n ?? 0);
  const adminRows = await sql<{ user_id: string }>`
    select user_id from profiles where role = 'administrador' and active = true limit 1
  `;
  if (n === 0 || adminRows.length === 0) {
    const users = await sql<{ id: string; name: string; email: string }>`
      select id, name, email from "user" where id = ${userId}
    `;
    const u = users[0];
    const name = u?.name?.trim() || "Administrador";
    const email = u?.email ?? "";
    await sql`
      insert into profiles (user_id, name, email, role, active)
      values (${userId}, ${name}, ${email}, 'administrador', true)
    `;
    return { userId, name, email, role: "administrador", active: true };
  }

  throw new AppError(
    "Acesso pendente. Peça ao administrador para cadastrar seu usuário.",
    403,
  );
}

export function assertRole(profile: Profile, roles: Role[]) {
  if (!roles.includes(profile.role)) {
    throw new AppError("Você não tem permissão para esta ação.", 403);
  }
}

export function canSeeAllOrders(profile: Profile) {
  return profile.role === "administrador" || profile.role === "diretor";
}
