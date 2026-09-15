import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import priceListJson from "@/lib/data/price-list.json";
import { assertRole, requireProfile } from "./guard";
import { mapClient, mapHubgov, mapProduct, mapSupplier } from "./mappers";


type PriceListItem = {
  sku: string;
  name: string;
  sap: string;
  line: string;
  group: string;
  usage: string;
  term: string;
  license: string;
  deploy: string;
  price: number;
  notes: string;
  promo: string;
};

const priceList = priceListJson as {
  version: string;
  items: PriceListItem[];
};

let catalogSync: Promise<void> | null = null;

async function ensureSchema(sql: Sql) {
  await sql.query(`alter table products add column if not exists sap_name text not null default ''`);
  await sql.query(`alter table products add column if not exists product_line text not null default ''`);
  await sql.query(`alter table products add column if not exists usage_type text not null default 'Commercial'`);
  await sql.query(`alter table products add column if not exists license_type text not null default ''`);
  await sql.query(`alter table products add column if not exists contract_term text not null default ''`);
  await sql.query(`alter table products add column if not exists deployment text not null default ''`);
  await sql.query(`alter table products add column if not exists notes text not null default ''`);
  await sql.query(`alter table products add column if not exists source text not null default 'manual'`);
  await sql.query(`create table if not exists catalog_meta (key text primary key, value text not null)`);
  await sql.query(`create index if not exists products_line_idx on products (product_line)`);
  await sql.query(`create index if not exists products_source_idx on products (source)`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function ensurePriceList(sql: Sql) {
  if (catalogSync) {
    await catalogSync;
    return;
  }
  catalogSync = (async () => {
    await ensureSchema(sql);
    const meta = await sql<{ value: string }>`
      select value from catalog_meta where key = 'price_list_version' limit 1
    `;
    if (meta[0]?.value === priceList.version) return;

    await sql.query(`
      update purchase_order_items
         set product_id = null
       where product_id in (
         select id from products where source is distinct from 'price_list'
       )
    `);
    await sql.query(`delete from products where source is distinct from 'price_list'`);

    for (const group of chunk(priceList.items, 40)) {
      const values: unknown[] = [];
      const tuples = group.map((item, i) => {
        const b = i * 13;
        values.push(
          item.sku,
          item.name,
          item.group || "Autodesk",
          item.price,
          true,
          item.sap,
          item.line,
          item.usage || "Commercial",
          item.license,
          item.term,
          item.deploy,
          [item.notes, item.promo].filter(Boolean).join(" · "),
          "price_list",
        );
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, $${b + 13})`;
      });
      await sql.query(
        `insert into products (
           sku, name, category, list_price_usd, active,
           sap_name, product_line, usage_type, license_type,
           contract_term, deployment, notes, source
         ) values ${tuples.join(", ")}
         on conflict (sku) do update set
           name = excluded.name,
           category = excluded.category,
           list_price_usd = excluded.list_price_usd,
           sap_name = excluded.sap_name,
           product_line = excluded.product_line,
           usage_type = excluded.usage_type,
           license_type = excluded.license_type,
           contract_term = excluded.contract_term,
           deployment = excluded.deployment,
           notes = excluded.notes,
           source = 'price_list',
           updated_at = now()`,
        values,
      );
    }

    const skus = priceList.items.map((item) => item.sku);
    const placeholders = skus.map((_, i) => `$${i + 1}`).join(", ");
    await sql.query(
      `update products
          set active = false, updated_at = now()
        where source = 'price_list' and sku not in (${placeholders})`,
      skus,
    );

    await sql.query(
      `insert into catalog_meta (key, value) values ('price_list_version', $1)
       on conflict (key) do update set value = excluded.value`,
      [priceList.version],
    );
  })().catch((err) => {
    catalogSync = null;
    throw err;
  });
  await catalogSync;
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    await ensurePriceList(sql);
    const rows = await sql`
      select * from products
      order by product_line, name, sku
    `;
    return rows.map(mapProduct);
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      sku: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      listPriceUsd: z.number().nonnegative(),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador"]);
    const sql = await getSql();
    await ensurePriceList(sql);
    if (data.id) {
      await sql`
        update products
        set sku = ${data.sku.trim()},
            name = ${data.name.trim()},
            category = ${data.category.trim()},
            list_price_usd = ${data.listPriceUsd},
            active = ${data.active},
            updated_at = now()
        where id = ${data.id}
      `;
      return { id: data.id };
    }
    const rows = await sql<{ id: number }>`
      insert into products (sku, name, category, list_price_usd, active, source)
      values (${data.sku.trim()}, ${data.name.trim()}, ${data.category.trim()}, ${data.listPriceUsd}, ${data.active}, 'manual')
      returning id
    `;
    return { id: rows[0].id };
  });

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql`select * from suppliers where active = true order by name`;
    return rows.map(mapSupplier);
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql`select * from clients order by name`;
    return rows.map(mapClient);
  });

export const findClientByCsn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ csn: z.string() }))
  .handler(async ({ context, data }) => {
    await requireProfile(context.userId);
    const csn = data.csn.trim();
    if (!csn) return null;
    const sql = await getSql();
    const rows = await sql`select * from clients where lower(csn) = ${csn.toLowerCase()} limit 1`;
    return rows[0] ? mapClient(rows[0]) : null;
  });

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      csn: z.string().min(1),
      name: z.string().min(1),
      document: z.string().min(1),
      email: z.string().optional().nullable(),
      managerName: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    const csn = data.csn.trim();
    const existing = await sql<{ id: number }>`
      select id from clients where lower(csn) = ${csn.toLowerCase()} limit 1
    `;
    if (existing[0]) {
      await sql`
        update clients
        set name = ${data.name.trim()},
            document = ${data.document.trim()},
            email = ${data.email?.trim() || null},
            manager_name = ${data.managerName?.trim() || null},
            phone = ${data.phone?.trim() || null},
            updated_at = now()
        where id = ${existing[0].id}
      `;
      return { id: existing[0].id };
    }
    const rows = await sql<{ id: number }>`
      insert into clients (csn, name, document, email, manager_name, phone, created_by)
      values (
        ${csn},
        ${data.name.trim()},
        ${data.document.trim()},
        ${data.email?.trim() || null},
        ${data.managerName?.trim() || null},
        ${data.phone?.trim() || null},
        ${context.userId}
      )
      returning id
    `;
    return { id: rows[0].id };
  });

export const listCredits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    const rows =
      profile.role === "vendedor"
        ? await sql`
            select h.*, po.client_name
            from hubgov_ledger h
            left join purchase_orders po on po.id = h.purchase_order_id
            where h.created_by = ${context.userId}
            order by h.created_at desc
            limit 200
          `
        : await sql`
            select h.*, po.client_name
            from hubgov_ledger h
            left join purchase_orders po on po.id = h.purchase_order_id
            order by h.created_at desc
            limit 400
          `;
    return rows.map(mapHubgov);
  });

export const creditSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<{ generated: string; used: string }>`
      select
        coalesce(sum(case when kind = 'generated' then amount else 0 end), 0) as generated,
        coalesce(sum(case when kind = 'used' then amount else 0 end), 0) as used
      from hubgov_ledger
    `;
    const generated = Number(rows[0]?.generated ?? 0);
    const used = Number(rows[0]?.used ?? 0);
    return { generated, used, remaining: generated - used };
  });

export const availableCredits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<{ nf_number: string; remaining: string }>`
      select nf_number,
             sum(case when kind = 'generated' then amount else -amount end)::text as remaining
      from hubgov_ledger
      where nf_number is not null and nf_number <> ''
      group by nf_number
      having sum(case when kind = 'generated' then amount else -amount end) > 0
      order by nf_number
    `;
    return rows.map((r) => ({ nf: r.nf_number, remaining: Number(r.remaining) }));
  });
