import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { DEFAULT_HUBGOV_PCT, MIN_NET_BRL } from "@/lib/company";
import { getSql, type Sql } from "@/lib/db";
import { buildMemo, computeOdc } from "@/lib/calc";
import { padSeq } from "@/lib/utils";
import { AppError, assertRole, canSeeAllOrders, requireProfile } from "./guard";
import { mapOdcItem, mapPurchaseOrder, mapSalesItem, mapSalesOrder } from "./mappers";

const itemSchema = z.object({
  productId: z.number().nullable(),
  productName: z.string().min(1),
  sku: z.string(),
  qty: z.number().positive(),
  listPriceUsd: z.number().nonnegative(),
});

const odcPayload = z.object({
  id: z.number().optional(),
  orderDate: z.string().min(8),
  supplierId: z.number(),
  clientType: z.enum(["governo", "privado"]),
  saleKind: z.enum(["nova", "renovacao"]),
  dollarRate: z.number().positive(),
  discountPct: z.number().min(0).max(100),
  hubgovCreditPct: z.number().min(0).max(100),
  licenseDelivery: z.enum(["imediato", "agendada"]),
  activationDate: z.string().nullable().optional(),
  paymentTermDays: z.number().int().min(0),
  creditUsed: z.number().min(0),
  creditNf: z.string().nullable().optional(),
  specialCondition: z.string().nullable().optional(),
  specialApprovedBy: z.string().nullable().optional(),
  signatureData: z.string().nullable().optional(),
  signedName: z.string().nullable().optional(),
  clientCsn: z.string().min(1),
  clientName: z.string().min(1),
  clientDocument: z.string().min(1),
  clientEmail: z.string().nullable().optional(),
  clientManager: z.string().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  renewalContracts: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  finalize: z.boolean(),
  items: z.array(itemSchema).min(1),
});

let orderSchemaReady: Promise<void> | null = null;

async function ensureOrderSchema(sql: Sql) {
  if (!orderSchemaReady) {
    orderSchemaReady = (async () => {
      await sql.query(`alter table purchase_orders drop constraint if exists purchase_orders_status_check`);
      await sql.query(`
        alter table purchase_orders add constraint purchase_orders_status_check
          check (status in ('rascunho', 'pendente_envio', 'enviado_pars', 'cancelado'))
      `);
    })().catch((err) => {
      orderSchemaReady = null;
      throw err;
    });
  }
  await orderSchemaReady;
}

async function nextNumber(sql: Awaited<ReturnType<typeof getSql>>, name: "odc" | "pv") {
  const rows = await sql<{ last_value: number }>`
    update document_counters set last_value = last_value + 1
    where name = ${name}
    returning last_value
  `;
  const seq = rows[0]?.last_value ?? 1;
  const prefix = name === "odc" ? "ODC" : "PV";
  return { seq, number: `${prefix}-${padSeq(seq)}` };
}

async function upsertClientFromOrder(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  data: z.infer<typeof odcPayload>,
) {
  const csn = data.clientCsn.trim();
  const existing = await sql<{ id: number }>`
    select id from clients where lower(csn) = ${csn.toLowerCase()} limit 1
  `;
  if (existing[0]) {
    await sql`
      update clients
      set name = ${data.clientName.trim()},
          document = ${data.clientDocument.trim()},
          email = ${data.clientEmail?.trim() || null},
          manager_name = ${data.clientManager?.trim() || null},
          phone = ${data.clientPhone?.trim() || null},
          updated_at = now()
      where id = ${existing[0].id}
    `;
    return existing[0].id;
  }
  const rows = await sql<{ id: number }>`
    insert into clients (csn, name, document, email, manager_name, phone, created_by)
    values (
      ${csn},
      ${data.clientName.trim()},
      ${data.clientDocument.trim()},
      ${data.clientEmail?.trim() || null},
      ${data.clientManager?.trim() || null},
      ${data.clientPhone?.trim() || null},
      ${userId}
    )
    returning id
  `;
  return rows[0].id;
}

function totalsFrom(data: z.infer<typeof odcPayload>) {
  const calc = computeOdc({
    items: data.items,
    dollarRate: data.dollarRate,
    discountPct: data.discountPct,
    clientType: data.clientType,
    hubgovCreditPct:
      data.clientType === "governo"
        ? data.hubgovCreditPct || DEFAULT_HUBGOV_PCT
        : 0,
    creditUsed: data.creditUsed,
  });
  if (data.finalize && calc.belowMinimum) {
    throw new AppError(
      `O valor líquido não pode ser inferior a R$ ${MIN_NET_BRL.toFixed(2)} ao utilizar crédito HubGov.`,
    );
  }
  if (data.clientType === "governo" && data.finalize && data.hubgovCreditPct < 8) {
    throw new AppError("Pedidos de governo devem gerar no mínimo 8% de crédito HubGov.");
  }
  if (data.creditUsed > 0 && !data.creditNf?.trim()) {
    throw new AppError("Informe a nota fiscal que gerou o crédito HubGov utilizado.");
  }
  if (data.licenseDelivery === "agendada" && !data.activationDate) {
    throw new AppError("Informe a data de ativação das licenças.");
  }
  if (data.saleKind === "renovacao" && !data.renewalContracts?.trim()) {
    throw new AppError("Informe o(s) número(s) de contrato que está(ão) sendo renovado(s).");
  }
  return calc;
}

export const previewNextOdc = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<{ last_value: number }>`
      select last_value from document_counters where name = 'odc'
    `;
    const next = (rows[0]?.last_value ?? 0) + 1;
    return { number: `ODC-${padSeq(next)}` };
  });

export const listPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = canSeeAllOrders(profile)
      ? await sql`
          select po.*, s.name as supplier_name, p.name as created_by_name
          from purchase_orders po
          join suppliers s on s.id = po.supplier_id
          left join profiles p on p.user_id = po.created_by
          order by po.seq desc
        `
      : await sql`
          select po.*, s.name as supplier_name, p.name as created_by_name
          from purchase_orders po
          join suppliers s on s.id = po.supplier_id
          left join profiles p on p.user_id = po.created_by
          where po.created_by = ${context.userId}
          order by po.seq desc
        `;
    return rows.map((r) => mapPurchaseOrder(r, []));
  });

export const getPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql`
      select po.*, s.name as supplier_name, p.name as created_by_name
      from purchase_orders po
      join suppliers s on s.id = po.supplier_id
      left join profiles p on p.user_id = po.created_by
      where po.id = ${data.id}
    `;
    if (!rows[0]) throw new AppError("Ordem de compra não encontrada.", 404);
    if (!canSeeAllOrders(profile) && String(rows[0].created_by) !== context.userId) {
      throw new AppError("Ordem de compra não encontrada.", 404);
    }
    const items = await sql`select * from purchase_order_items where purchase_order_id = ${data.id} order by id`;
    return mapPurchaseOrder(rows[0], items.map(mapOdcItem));
  });

export const savePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(odcPayload)
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador", "vendedor", "diretor"]);
    const sql = await getSql();
    await ensureOrderSchema(sql);
    const calc = totalsFrom(data);
    const clientId = await upsertClientFromOrder(sql, context.userId, data);
    const status = data.finalize ? "pendente_envio" : "rascunho";
    const signedAt = null;
    const hubPct = data.clientType === "governo" ? data.hubgovCreditPct : 0;

    const persistItems = async (orderId: number) => {
      await sql`delete from purchase_order_items where purchase_order_id = ${orderId}`;
      for (const it of data.items) {
        const lineUsd = it.qty * it.listPriceUsd;
        const lineBrl = lineUsd * data.dollarRate;
        await sql`
          insert into purchase_order_items (
            purchase_order_id, product_id, product_name, sku, qty,
            list_price_usd, line_total_usd, line_total_brl
          ) values (
            ${orderId}, ${it.productId}, ${it.productName}, ${it.sku}, ${it.qty},
            ${it.listPriceUsd}, ${lineUsd}, ${lineBrl}
          )
        `;
      }
    };

    if (data.id) {
      const current = await sql<{ status: string; created_by: string }>`
        select status, created_by from purchase_orders where id = ${data.id}
      `;
      if (!current[0]) throw new AppError("Ordem de compra não encontrada.", 404);
      if (current[0].status === "enviado_pars") {
        throw new AppError("Pedido enviado à PARS não pode ser alterado.");
      }
      if (current[0].status === "cancelado") {
        throw new AppError("Pedido cancelado não pode ser alterado.");
      }
      if (!canSeeAllOrders(profile) && current[0].created_by !== context.userId) {
        throw new AppError("Sem permissão para editar este pedido.", 403);
      }
      await sql`
        update purchase_orders set
          order_date = ${data.orderDate},
          supplier_id = ${data.supplierId},
          client_type = ${data.clientType},
          sale_kind = ${data.saleKind},
          status = ${status},
          dollar_rate = ${data.dollarRate},
          discount_pct = ${data.discountPct},
          hubgov_credit_pct = ${hubPct},
          license_delivery = ${data.licenseDelivery},
          activation_date = ${data.licenseDelivery === "agendada" ? data.activationDate : null},
          payment_term_days = ${data.paymentTermDays},
          credit_used = ${data.creditUsed},
          credit_nf = ${data.creditNf?.trim() || null},
          special_condition = ${data.specialCondition?.trim() || null},
          special_approved_by = ${data.specialApprovedBy?.trim() || null},
          signature_data = ${data.signatureData || null},
          signed_at = ${signedAt},
          signed_name = ${data.signedName?.trim() || null},
          client_id = ${clientId},
          client_csn = ${data.clientCsn.trim()},
          client_name = ${data.clientName.trim()},
          client_document = ${data.clientDocument.trim()},
          client_email = ${data.clientEmail?.trim() || null},
          client_manager = ${data.clientManager?.trim() || null},
          client_phone = ${data.clientPhone?.trim() || null},
          renewal_contracts = ${data.renewalContracts?.trim() || null},
          notes = ${data.notes?.trim() || null},
          list_total_usd = ${calc.listTotalUsd},
          list_total_brl = ${calc.listTotalBrl},
          discount_amount = ${calc.discountAmount},
          net_total_brl = ${calc.netTotalBrl},
          credit_generated = ${calc.creditGenerated},
          updated_at = now()
        where id = ${data.id}
      `;
      await persistItems(data.id);
      return { id: data.id, status };
    }

    const { seq, number } = await nextNumber(sql, "odc");
    const rows = await sql<{ id: number }>`
      insert into purchase_orders (
        number, seq, order_date, supplier_id, client_type, sale_kind, status,
        dollar_rate, discount_pct, hubgov_credit_pct, license_delivery, activation_date,
        payment_term_days, credit_used, credit_nf, special_condition, special_approved_by,
        signature_data, signed_at, signed_name, client_id, client_csn, client_name,
        client_document, client_email, client_manager, client_phone, renewal_contracts,
        notes, list_total_usd, list_total_brl, discount_amount, net_total_brl,
        credit_generated, created_by
      ) values (
        ${number}, ${seq}, ${data.orderDate}, ${data.supplierId}, ${data.clientType},
        ${data.saleKind}, ${status}, ${data.dollarRate}, ${data.discountPct}, ${hubPct},
        ${data.licenseDelivery},
        ${data.licenseDelivery === "agendada" ? data.activationDate : null},
        ${data.paymentTermDays}, ${data.creditUsed}, ${data.creditNf?.trim() || null},
        ${data.specialCondition?.trim() || null}, ${data.specialApprovedBy?.trim() || null},
        ${data.signatureData || null}, ${signedAt}, ${data.signedName?.trim() || null},
        ${clientId}, ${data.clientCsn.trim()}, ${data.clientName.trim()},
        ${data.clientDocument.trim()}, ${data.clientEmail?.trim() || null},
        ${data.clientManager?.trim() || null}, ${data.clientPhone?.trim() || null},
        ${data.renewalContracts?.trim() || null}, ${data.notes?.trim() || null},
        ${calc.listTotalUsd}, ${calc.listTotalBrl}, ${calc.discountAmount},
        ${calc.netTotalBrl}, ${calc.creditGenerated}, ${context.userId}
      )
      returning id
    `;
    const id = rows[0].id;
    await persistItems(id);
    return { id, number, status };
  });

export const markOdcSent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    await ensureOrderSchema(sql);
    const rows = await sql<Record<string, unknown>>`
      select * from purchase_orders where id = ${data.id}
    `;
    if (!rows[0]) throw new AppError("Ordem de compra não encontrada.", 404);
    const order = mapPurchaseOrder(rows[0]);
    if (!canSeeAllOrders(profile) && order.createdBy !== context.userId) {
      throw new AppError("Sem permissão.", 403);
    }
    if (order.status === "enviado_pars") return { ok: true };
    if (order.status === "cancelado") {
      throw new AppError("Pedido cancelado não pode ser enviado à PARS.");
    }
    if (order.status !== "pendente_envio") {
      throw new AppError("Finalize o pedido antes de marcar o envio à PARS.");
    }

    await sql`
      update purchase_orders
      set status = 'enviado_pars', sent_at = now(), updated_at = now()
      where id = ${data.id}
    `;

    if (order.creditUsed > 0) {
      await sql`
        insert into hubgov_ledger (client_id, purchase_order_id, kind, amount, nf_number, created_by)
        values (${order.clientId}, ${order.id}, 'used', ${order.creditUsed}, ${order.creditNf}, ${context.userId})
      `;
    }
    if (order.clientType === "governo" && order.creditGenerated > 0) {
      const nf = `HUB-${order.number}`;
      await sql`
        insert into hubgov_ledger (client_id, purchase_order_id, kind, amount, nf_number, created_by)
        values (${order.clientId}, ${order.id}, 'generated', ${order.creditGenerated}, ${nf}, ${context.userId})
      `;
    }
    return { ok: true };
  });

export const cancelPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador", "vendedor", "diretor"]);
    const sql = await getSql();
    await ensureOrderSchema(sql);
    const rows = await sql<{ status: string; created_by: string; number: string }>`
      select status, created_by, number from purchase_orders where id = ${data.id}
    `;
    if (!rows[0]) throw new AppError("Ordem de compra não encontrada.", 404);
    if (!canSeeAllOrders(profile) && rows[0].created_by !== context.userId) {
      throw new AppError("Sem permissão para cancelar este pedido.", 403);
    }
    if (rows[0].status === "cancelado") return { ok: true };

    await sql`
      update purchase_orders
      set status = 'cancelado', updated_at = now()
      where id = ${data.id}
    `;
    await sql`
      update sales_orders
      set status = 'cancelado', updated_at = now()
      where purchase_order_id = ${data.id} and status <> 'cancelado'
    `;
    await sql`delete from hubgov_ledger where purchase_order_id = ${data.id}`;
    return { ok: true, number: rows[0].number };
  });

export const cancelSalesOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    assertRole(profile, ["administrador", "vendedor", "diretor"]);
    const sql = await getSql();
    const rows = await sql<{ status: string; created_by: string; seller_id: string; number: string }>`
      select status, created_by, seller_id, number from sales_orders where id = ${data.id}
    `;
    if (!rows[0]) throw new AppError("Pedido de venda não encontrado.", 404);
    if (
      !canSeeAllOrders(profile) &&
      rows[0].created_by !== context.userId &&
      rows[0].seller_id !== context.userId
    ) {
      throw new AppError("Sem permissão para cancelar este pedido.", 403);
    }
    if (rows[0].status === "cancelado") return { ok: true };

    await sql`
      update sales_orders
      set status = 'cancelado', updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true, number: rows[0].number };
  });

export const listSalesOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = canSeeAllOrders(profile)
      ? await sql`
          select so.*, po.number as purchase_order_number, po.client_name, po.client_csn
          from sales_orders so
          join purchase_orders po on po.id = so.purchase_order_id
          order by so.seq desc
        `
      : await sql`
          select so.*, po.number as purchase_order_number, po.client_name, po.client_csn
          from sales_orders so
          join purchase_orders po on po.id = so.purchase_order_id
          where so.created_by = ${context.userId} or so.seller_id = ${context.userId}
          order by so.seq desc
        `;
    return rows.map((r) => mapSalesOrder(r, []));
  });

export const getSalesOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql`
      select so.*, po.number as purchase_order_number, po.client_name, po.client_csn
      from sales_orders so
      join purchase_orders po on po.id = so.purchase_order_id
      where so.id = ${data.id}
    `;
    if (!rows[0]) throw new AppError("Pedido de venda não encontrado.", 404);
    if (
      !canSeeAllOrders(profile) &&
      String(rows[0].created_by) !== context.userId &&
      String(rows[0].seller_id) !== context.userId
    ) {
      throw new AppError("Pedido de venda não encontrado.", 404);
    }
    const items = await sql`select * from sales_order_items where sales_order_id = ${data.id} order by id`;
    return mapSalesOrder(rows[0], items.map(mapSalesItem));
  });

export const saveSalesOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      purchaseOrderId: z.number(),
      orderDate: z.string().min(8),
      clientType: z.enum(["governo", "privado"]),
      contractNumber: z.string().nullable().optional(),
      proposalNumber: z.string().nullable().optional(),
      acceptanceDate: z.string().nullable().optional(),
      marginPct: z.number(),
      sellerId: z.string().min(1),
      sellerName: z.string().min(1),
      financeContactName: z.string().nullable().optional(),
      financeContact: z.string().nullable().optional(),
      paymentTermDays: z.number().int().min(0),
      items: z
        .array(
          z.object({
            productName: z.string(),
            sku: z.string(),
            qty: z.number().positive(),
            unitPriceBrl: z.number().nonnegative(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    const poRows = await sql<Record<string, unknown>>`
      select * from purchase_orders where id = ${data.purchaseOrderId}
    `;
    if (!poRows[0]) throw new AppError("Ordem de compra não encontrada.", 404);
    const po = mapPurchaseOrder(poRows[0]);
    if (po.status === "rascunho") {
      throw new AppError("Finalize a ordem de compra antes de gerar o pedido de venda.");
    }
    if (po.status === "cancelado") {
      throw new AppError("Não é possível gerar venda a partir de uma ordem cancelada.");
    }
    if (data.clientType === "governo" && !data.contractNumber?.trim()) {
      throw new AppError("Informe o número do contrato administrativo.");
    }
    if (data.clientType === "privado") {
      if (!data.proposalNumber?.trim()) throw new AppError("Informe o número da proposta.");
      if (!data.acceptanceDate) throw new AppError("Informe a data do aceite.");
    }

    const saleTotal = data.items.reduce((acc, it) => acc + it.qty * it.unitPriceBrl, 0);
    const memo = buildMemo({
      items: po.items.length
        ? po.items
        : [{ qty: 1, listPriceUsd: po.listTotalUsd }],
      dollarRate: po.dollarRate,
      discountPct: po.discountPct,
      clientType: po.clientType,
      hubgovCreditPct: po.hubgovCreditPct,
      creditUsed: po.creditUsed,
      ...computeOdc({
        items: [{ qty: 1, listPriceUsd: po.listTotalUsd }],
        dollarRate: po.dollarRate,
        discountPct: po.discountPct,
        clientType: po.clientType,
        hubgovCreditPct: po.hubgovCreditPct,
        creditUsed: po.creditUsed,
      }),
    });

    const persistItems = async (id: number) => {
      await sql`delete from sales_order_items where sales_order_id = ${id}`;
      for (const it of data.items) {
        const line = it.qty * it.unitPriceBrl;
        await sql`
          insert into sales_order_items (sales_order_id, product_name, sku, qty, unit_price_brl, line_total_brl)
          values (${id}, ${it.productName}, ${it.sku}, ${it.qty}, ${it.unitPriceBrl}, ${line})
        `;
      }
    };

    if (data.id) {
      const current = await sql<{ created_by: string; status: string }>`
        select created_by, status from sales_orders where id = ${data.id}
      `;
      if (!current[0]) throw new AppError("Pedido de venda não encontrado.", 404);
      if (current[0].status === "cancelado") {
        throw new AppError("Pedido de venda cancelado não pode ser alterado.");
      }
      if (!canSeeAllOrders(profile) && current[0].created_by !== context.userId) {
        throw new AppError("Sem permissão.", 403);
      }
      await sql`
        update sales_orders set
          order_date = ${data.orderDate},
          client_type = ${data.clientType},
          contract_number = ${data.contractNumber?.trim() || null},
          proposal_number = ${data.proposalNumber?.trim() || null},
          acceptance_date = ${data.acceptanceDate || null},
          margin_pct = ${data.marginPct},
          seller_id = ${data.sellerId},
          seller_name = ${data.sellerName},
          finance_contact_name = ${data.financeContactName?.trim() || null},
          finance_contact = ${data.financeContact?.trim() || null},
          payment_term_days = ${data.paymentTermDays},
          calculation_memo = ${memo},
          credit_used = ${po.creditUsed},
          credit_generated = ${po.creditGenerated},
          sale_total_brl = ${saleTotal},
          updated_at = now()
        where id = ${data.id}
      `;
      await persistItems(data.id);
      return { id: data.id };
    }

    const existing = await sql<{ id: number }>`
      select id from sales_orders
      where purchase_order_id = ${data.purchaseOrderId} and status <> 'cancelado'
      limit 1
    `;
    if (existing[0]) {
      throw new AppError("Esta ordem de compra já possui pedido de venda.");
    }

    const { seq, number } = await nextNumber(sql, "pv");
    const rows = await sql<{ id: number }>`
      insert into sales_orders (
        number, seq, purchase_order_id, order_date, client_type, contract_number,
        proposal_number, acceptance_date, margin_pct, seller_id, seller_name,
        finance_contact_name, finance_contact, payment_term_days, calculation_memo,
        credit_used, credit_generated, sale_total_brl, created_by
      ) values (
        ${number}, ${seq}, ${data.purchaseOrderId}, ${data.orderDate}, ${data.clientType},
        ${data.contractNumber?.trim() || null}, ${data.proposalNumber?.trim() || null},
        ${data.acceptanceDate || null}, ${data.marginPct}, ${data.sellerId}, ${data.sellerName},
        ${data.financeContactName?.trim() || null}, ${data.financeContact?.trim() || null},
        ${data.paymentTermDays}, ${memo}, ${po.creditUsed}, ${po.creditGenerated},
        ${saleTotal}, ${context.userId}
      )
      returning id
    `;
    const id = rows[0].id;
    await persistItems(id);
    return { id, number };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await requireProfile(context.userId);
    const sql = await getSql();
    const own = !canSeeAllOrders(profile);
    const odc = own
      ? await sql<{ n: number; net: string }>`
          select count(*)::int as n, coalesce(sum(net_total_brl),0)::text as net
          from purchase_orders
          where created_by = ${context.userId} and status <> 'cancelado'
        `
      : await sql<{ n: number; net: string }>`
          select count(*)::int as n, coalesce(sum(net_total_brl),0)::text as net
          from purchase_orders where status <> 'cancelado'
        `;
    const sales = own
      ? await sql<{ n: number; total: string }>`
          select count(*)::int as n, coalesce(sum(sale_total_brl),0)::text as total
          from sales_orders
          where (created_by = ${context.userId} or seller_id = ${context.userId})
            and status <> 'cancelado'
        `
      : await sql<{ n: number; total: string }>`
          select count(*)::int as n, coalesce(sum(sale_total_brl),0)::text as total
          from sales_orders where status <> 'cancelado'
        `;
    const pending = own
      ? await sql<{ n: number }>`
          select count(*)::int as n from purchase_orders
          where status = 'pendente_envio' and created_by = ${context.userId}
        `
      : await sql<{ n: number }>`
          select count(*)::int as n from purchase_orders where status = 'pendente_envio'
        `;
    const credits = await sql<{ generated: string; used: string }>`
      select
        coalesce(sum(case when kind='generated' then amount else 0 end),0)::text as generated,
        coalesce(sum(case when kind='used' then amount else 0 end),0)::text as used
      from hubgov_ledger
    `;
    return {
      odcCount: odc[0]?.n ?? 0,
      odcNet: Number(odc[0]?.net ?? 0),
      salesCount: sales[0]?.n ?? 0,
      salesTotal: Number(sales[0]?.total ?? 0),
      pendingPars: pending[0]?.n ?? 0,
      creditGenerated: Number(credits[0]?.generated ?? 0),
      creditUsed: Number(credits[0]?.used ?? 0),
    };
  });
