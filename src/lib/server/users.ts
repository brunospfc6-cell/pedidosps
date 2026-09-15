import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { Role } from "@/lib/types";
import { AppError, assertRole, requireProfile } from "./guard";

const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres.");

export const listUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador"]);
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      name: string;
      email: string;
      role: Role;
      active: boolean;
      created_at: string;
    }>`
      select user_id, name, email, role, active, created_at
      from profiles
      order by created_at desc
    `;
    const pending = await sql<{ id: string; name: string; email: string }>`
      select u.id, u.name, u.email
      from "user" u
      left join profiles p on p.user_id = u.id
      where p.user_id is null
      order by u."createdAt" desc
    `;
    return {
      users: rows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        email: r.email,
        role: r.role,
        active: r.active,
        createdAt: r.created_at,
      })),
      pending: pending.map((p) => ({ userId: p.id, name: p.name, email: p.email })),
    };
  });

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().min(2),
      email: z.string().email(),
      role: z.enum(["administrador", "vendedor", "diretor"]),
      password: passwordSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador"]);
    const sql = await getSql();
    const email = data.email.trim().toLowerCase();
    const existing = await sql<{ id: string }>`select id from "user" where email = ${email}`;
    if (existing[0]) throw new AppError("Já existe um usuário com este e-mail.");
    const password = data.password;
    const hashed = await hashPassword(password);
    const id = crypto.randomUUID();
    const accId = crypto.randomUUID();
    const now = new Date();
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${id}, ${data.name.trim()}, ${email}, true, ${now}, ${now})
    `;
    await sql`
      insert into account ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
      values (${accId}, ${id}, 'credential', ${id}, ${hashed}, ${now}, ${now})
    `;
    await sql`
      insert into profiles (user_id, name, email, role, active, created_by)
      values (${id}, ${data.name.trim()}, ${email}, ${data.role}, true, ${context.userId})
    `;
    return { userId: id, email, password };
  });

export const assignPendingUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string(),
      role: z.enum(["administrador", "vendedor", "diretor"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador"]);
    const sql = await getSql();
    const users = await sql<{ id: string; name: string; email: string }>`
      select id, name, email from "user" where id = ${data.userId}
    `;
    if (!users[0]) throw new AppError("Usuário não encontrado.");
    await sql`
      insert into profiles (user_id, name, email, role, active, created_by)
      values (${users[0].id}, ${users[0].name}, ${users[0].email}, ${data.role}, true, ${context.userId})
      on conflict (user_id) do update set role = excluded.role, active = true
    `;
    return { ok: true };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string(),
      name: z.string().min(2),
      role: z.enum(["administrador", "vendedor", "diretor"]),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador"]);
    if (data.userId === context.userId && !data.active) {
      throw new AppError("Você não pode desativar a própria conta.");
    }
    const sql = await getSql();
    await sql`
      update profiles
      set name = ${data.name.trim()}, role = ${data.role}, active = ${data.active}
      where user_id = ${data.userId}
    `;
    await sql`update "user" set name = ${data.name.trim()} where id = ${data.userId}`;
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string(),
      password: passwordSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador"]);
    const password = data.password;
    const hashed = await hashPassword(password);
    const sql = await getSql();
    const acc = await sql<{ id: string }>`
      select id from account where "userId" = ${data.userId} and "providerId" = 'credential' limit 1
    `;
    const now = new Date();
    if (acc[0]) {
      await sql`update account set password = ${hashed}, "updatedAt" = ${now} where id = ${acc[0].id}`;
    } else {
      const id = crypto.randomUUID();
      await sql`
        insert into account ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
        values (${id}, ${data.userId}, 'credential', ${data.userId}, ${hashed}, ${now}, ${now})
      `;
    }
    return { password };
  });
