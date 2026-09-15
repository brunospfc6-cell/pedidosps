import { num } from "@/lib/utils";
import type {
  Client,
  ClientType,
  HubgovEntry,
  LicenseDelivery,
  OdcItem,
  OdcStatus,
  Product,
  PurchaseOrder,
  SaleKind,
  SalesItem,
  SalesOrder,
  SalesStatus,
  Supplier,
} from "@/lib/types";

export function mapProduct(r: Record<string, unknown>): Product {
  return {
    id: num(r.id),
    sku: String(r.sku),
    name: String(r.name),
    category: String(r.category ?? "Autodesk"),
    productLine: String(r.product_line ?? ""),
    sapName: String(r.sap_name ?? ""),
    usageType: String(r.usage_type ?? "Commercial"),
    licenseType: String(r.license_type ?? ""),
    contractTerm: String(r.contract_term ?? ""),
    deployment: String(r.deployment ?? ""),
    notes: String(r.notes ?? ""),
    listPriceUsd: num(r.list_price_usd),
    active: Boolean(r.active),
  };
}

export function mapSupplier(r: Record<string, unknown>): Supplier {
  return {
    id: num(r.id),
    name: String(r.name),
    cnpj: String(r.cnpj),
    city: r.city ? String(r.city) : null,
    state: r.state ? String(r.state) : null,
  };
}

export function mapClient(r: Record<string, unknown>): Client {
  return {
    id: num(r.id),
    csn: String(r.csn),
    name: String(r.name),
    document: String(r.document),
    email: r.email ? String(r.email) : null,
    managerName: r.manager_name ? String(r.manager_name) : null,
    phone: r.phone ? String(r.phone) : null,
  };
}

export function mapOdcItem(r: Record<string, unknown>): OdcItem {
  return {
    id: num(r.id),
    productId: r.product_id == null ? null : num(r.product_id),
    productName: String(r.product_name),
    sku: String(r.sku ?? ""),
    qty: num(r.qty),
    listPriceUsd: num(r.list_price_usd),
    lineTotalUsd: num(r.line_total_usd),
    lineTotalBrl: num(r.line_total_brl),
  };
}

export function mapPurchaseOrder(
  r: Record<string, unknown>,
  items: OdcItem[] = [],
): PurchaseOrder {
  return {
    id: num(r.id),
    number: String(r.number),
    seq: num(r.seq),
    orderDate: String(r.order_date).slice(0, 10),
    supplierId: num(r.supplier_id),
    supplierName: r.supplier_name ? String(r.supplier_name) : undefined,
    clientType: r.client_type as ClientType,
    saleKind: (r.sale_kind as SaleKind) ?? "nova",
    status: r.status as OdcStatus,
    dollarRate: num(r.dollar_rate),
    discountPct: num(r.discount_pct),
    hubgovCreditPct: num(r.hubgov_credit_pct),
    licenseDelivery: (r.license_delivery as LicenseDelivery) ?? "imediato",
    activationDate: r.activation_date ? String(r.activation_date).slice(0, 10) : null,
    paymentTermDays: num(r.payment_term_days),
    creditUsed: num(r.credit_used),
    creditNf: r.credit_nf ? String(r.credit_nf) : null,
    specialCondition: r.special_condition ? String(r.special_condition) : null,
    specialApprovedBy: r.special_approved_by ? String(r.special_approved_by) : null,
    signatureData: r.signature_data ? String(r.signature_data) : null,
    signedAt: r.signed_at ? String(r.signed_at) : null,
    signedName: r.signed_name ? String(r.signed_name) : null,
    clientId: r.client_id == null ? null : num(r.client_id),
    clientCsn: r.client_csn ? String(r.client_csn) : null,
    clientName: r.client_name ? String(r.client_name) : null,
    clientDocument: r.client_document ? String(r.client_document) : null,
    clientEmail: r.client_email ? String(r.client_email) : null,
    clientManager: r.client_manager ? String(r.client_manager) : null,
    clientPhone: r.client_phone ? String(r.client_phone) : null,
    renewalContracts: r.renewal_contracts ? String(r.renewal_contracts) : null,
    notes: r.notes ? String(r.notes) : null,
    listTotalUsd: num(r.list_total_usd),
    listTotalBrl: num(r.list_total_brl),
    discountAmount: num(r.discount_amount),
    netTotalBrl: num(r.net_total_brl),
    creditGenerated: num(r.credit_generated),
    createdBy: String(r.created_by),
    createdByName: r.created_by_name ? String(r.created_by_name) : undefined,
    createdAt: String(r.created_at),
    sentAt: r.sent_at ? String(r.sent_at) : null,
    items,
  };
}

export function mapSalesItem(r: Record<string, unknown>): SalesItem {
  return {
    id: num(r.id),
    productName: String(r.product_name),
    sku: String(r.sku ?? ""),
    qty: num(r.qty),
    unitPriceBrl: num(r.unit_price_brl),
    lineTotalBrl: num(r.line_total_brl),
  };
}

export function mapSalesOrder(
  r: Record<string, unknown>,
  items: SalesItem[] = [],
): SalesOrder {
  return {
    id: num(r.id),
    number: String(r.number),
    purchaseOrderId: num(r.purchase_order_id),
    purchaseOrderNumber: r.purchase_order_number ? String(r.purchase_order_number) : undefined,
    orderDate: String(r.order_date).slice(0, 10),
    clientType: r.client_type as ClientType,
    contractNumber: r.contract_number ? String(r.contract_number) : null,
    proposalNumber: r.proposal_number ? String(r.proposal_number) : null,
    acceptanceDate: r.acceptance_date ? String(r.acceptance_date).slice(0, 10) : null,
    marginPct: num(r.margin_pct),
    sellerId: String(r.seller_id),
    sellerName: String(r.seller_name),
    financeContactName: r.finance_contact_name ? String(r.finance_contact_name) : null,
    financeContact: r.finance_contact ? String(r.finance_contact) : null,
    paymentTermDays: r.payment_term_days == null ? null : num(r.payment_term_days),
    calculationMemo: String(r.calculation_memo ?? ""),
    creditUsed: num(r.credit_used),
    creditGenerated: num(r.credit_generated),
    saleTotalBrl: num(r.sale_total_brl),
    status: (r.status as SalesStatus) || "aberto",
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    clientName: r.client_name ? String(r.client_name) : null,
    clientCsn: r.client_csn ? String(r.client_csn) : null,
    items,
  };
}

export function mapHubgov(r: Record<string, unknown>): HubgovEntry {
  return {
    id: num(r.id),
    kind: r.kind as "generated" | "used",
    amount: num(r.amount),
    nfNumber: r.nf_number ? String(r.nf_number) : null,
    purchaseOrderId: r.purchase_order_id == null ? null : num(r.purchase_order_id),
    createdAt: String(r.created_at),
    clientName: r.client_name ? String(r.client_name) : null,
  };
}
