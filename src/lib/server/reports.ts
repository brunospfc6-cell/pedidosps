import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { num } from "@/lib/utils";
import { assertRole, requireProfile } from "./guard";

export const directorOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador", "diretor"]);
    const sql = await getSql();

    const sales = await sql<{
      order_date: string;
      sale_total_brl: string;
      client_type: string;
      seller_name: string;
      margin_pct: string;
    }>`
      select order_date, sale_total_brl, client_type, seller_name, margin_pct
      from sales_orders
      where status <> 'cancelado'
    `;

    const monthMap = new Map<string, { total: number; n: number }>();
    const typeMap = new Map<string, { total: number; n: number }>();
    const sellerMap = new Map<string, { total: number; n: number; marginSum: number }>();
    for (const r of sales) {
      const month = String(r.order_date).slice(0, 7);
      const total = num(r.sale_total_brl);
      const m = monthMap.get(month) ?? { total: 0, n: 0 };
      m.total += total;
      m.n += 1;
      monthMap.set(month, m);
      const t = typeMap.get(r.client_type) ?? { total: 0, n: 0 };
      t.total += total;
      t.n += 1;
      typeMap.set(r.client_type, t);
      const s = sellerMap.get(r.seller_name) ?? { total: 0, n: 0, marginSum: 0 };
      s.total += total;
      s.n += 1;
      s.marginSum += num(r.margin_pct);
      sellerMap.set(r.seller_name, s);
    }

    const items = await sql<{ product_name: string; qty: string; line_total_brl: string }>`
      select soi.product_name, soi.qty, soi.line_total_brl
      from sales_order_items soi
      join sales_orders so on so.id = soi.sales_order_id
      where so.status <> 'cancelado'
    `;
    const prodMap = new Map<string, { qty: number; total: number }>();
    for (const it of items) {
      const p = prodMap.get(it.product_name) ?? { qty: 0, total: 0 };
      p.qty += num(it.qty);
      p.total += num(it.line_total_brl);
      prodMap.set(it.product_name, p);
    }

    return {
      monthly: [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, total: v.total, n: v.n })),
      byType: [...typeMap.entries()].map(([type, v]) => ({ type, total: v.total, n: v.n })),
      bySeller: [...sellerMap.entries()]
        .map(([seller, v]) => ({
          seller,
          total: v.total,
          n: v.n,
          margin: v.n ? v.marginSum / v.n : 0,
        }))
        .sort((a, b) => b.total - a.total),
      topProducts: [...prodMap.entries()]
        .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    };
  });

export const exportOrdersCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ kind: z.enum(["odc", "vendas"]) }))
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador", "diretor"]);
    const sql = await getSql();
    if (data.kind === "odc") {
      const rows = await sql<Record<string, string | number | null>>`
        select po.number, po.order_date, po.status, po.client_type, po.sale_kind,
               po.client_csn, po.client_name, po.client_document, s.name as supplier,
               po.dollar_rate, po.list_total_usd, po.list_total_brl, po.discount_pct,
               po.discount_amount, po.credit_used, po.credit_generated, po.net_total_brl,
               po.payment_term_days, p.name as vendedor
        from purchase_orders po
        join suppliers s on s.id = po.supplier_id
        left join profiles p on p.user_id = po.created_by
        order by po.seq
      `;
      return rows.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ""])) as Record<string, string>,
      );
    }
    const rows = await sql<Record<string, string | number | null>>`
      select so.number, so.order_date, so.status, so.client_type, po.number as odc, po.client_name,
             po.client_csn, so.contract_number, so.proposal_number, so.acceptance_date,
             so.margin_pct, so.seller_name, so.sale_total_brl, so.credit_used,
             so.credit_generated, so.payment_term_days, so.finance_contact_name
      from sales_orders so
      join purchase_orders po on po.id = so.purchase_order_id
      order by so.seq
    `;
    return rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ""])) as Record<string, string>,
    );
  });
