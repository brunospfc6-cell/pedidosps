import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requireProfile } from "./guard";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const profile = await requireProfile(context.userId);
      return { ok: true as const, profile };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Acesso negado";
      return { ok: false as const, message };
    }
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<{ user_id: string; name: string; role: string }>`
      select user_id, name, role from profiles where active = true order by name
    `;
    return rows.map((r) => ({ userId: r.user_id, name: r.name, role: r.role }));
  });
