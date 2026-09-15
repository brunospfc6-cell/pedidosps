export type Role = "administrador" | "vendedor" | "diretor";

export type ClientType = "governo" | "privado";
export type SaleKind = "nova" | "renovacao";
export type OdcStatus = "rascunho" | "pendente_envio" | "enviado_pars" | "cancelado";
export type SalesStatus = "aberto" | "cancelado";
export type LicenseDelivery = "imediato" | "agendada";

export type Profile = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  pending?: boolean;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  productLine: string;
  sapName: string;
  usageType: string;
  licenseType: string;
  contractTerm: string;
  deployment: string;
  notes: string;
  listPriceUsd: number;
  active: boolean;
};


export type Supplier = {
  id: number;
  name: string;
  cnpj: string;
  city: string | null;
  state: string | null;
};

export type Client = {
  id: number;
  csn: string;
  name: string;
  document: string;
  email: string | null;
  managerName: string | null;
  phone: string | null;
};

export type OdcItem = {
  id?: number;
  productId: number | null;
  productName: string;
  sku: string;
  qty: number;
  listPriceUsd: number;
  lineTotalUsd: number;
  lineTotalBrl: number;
};

export type PurchaseOrder = {
  id: number;
  number: string;
  seq: number;
  orderDate: string;
  supplierId: number;
  supplierName?: string;
  clientType: ClientType;
  saleKind: SaleKind;
  status: OdcStatus;
  dollarRate: number;
  discountPct: number;
  hubgovCreditPct: number;
  licenseDelivery: LicenseDelivery;
  activationDate: string | null;
  paymentTermDays: number;
  creditUsed: number;
  creditNf: string | null;
  specialCondition: string | null;
  specialApprovedBy: string | null;
  signatureData: string | null;
  signedAt: string | null;
  signedName: string | null;
  clientId: number | null;
  clientCsn: string | null;
  clientName: string | null;
  clientDocument: string | null;
  clientEmail: string | null;
  clientManager: string | null;
  clientPhone: string | null;
  renewalContracts: string | null;
  notes: string | null;
  listTotalUsd: number;
  listTotalBrl: number;
  discountAmount: number;
  netTotalBrl: number;
  creditGenerated: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  sentAt: string | null;
  items: OdcItem[];
};

export type SalesItem = {
  id?: number;
  productName: string;
  sku: string;
  qty: number;
  unitPriceBrl: number;
  lineTotalBrl: number;
};

export type SalesOrder = {
  id: number;
  number: string;
  purchaseOrderId: number;
  purchaseOrderNumber?: string;
  orderDate: string;
  clientType: ClientType;
  contractNumber: string | null;
  proposalNumber: string | null;
  acceptanceDate: string | null;
  marginPct: number;
  sellerId: string;
  sellerName: string;
  financeContactName: string | null;
  financeContact: string | null;
  paymentTermDays: number | null;
  calculationMemo: string;
  creditUsed: number;
  creditGenerated: number;
  saleTotalBrl: number;
  status: SalesStatus;
  createdBy: string;
  createdAt: string;
  clientName?: string | null;
  clientCsn?: string | null;
  items: SalesItem[];
};

export type HubgovEntry = {
  id: number;
  kind: "generated" | "used";
  amount: number;
  nfNumber: string | null;
  purchaseOrderId: number | null;
  createdAt: string;
  clientName?: string | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  administrador: "Administrador",
  vendedor: "Vendedor",
  diretor: "Diretor",
};

export const SALE_KIND_LABEL: Record<SaleKind, string> = {
  nova: "Novas Licenças",
  renovacao: "Renovação de Licenças",
};

export const STATUS_LABEL: Record<OdcStatus, string> = {
  rascunho: "Rascunho",
  pendente_envio: "Pendente Envio à PARS",
  enviado_pars: "Enviado à PARS",
  cancelado: "Cancelado",
};

export const SALES_STATUS_LABEL: Record<SalesStatus, string> = {
  aberto: "Aberto",
  cancelado: "Cancelado",
};

export const PRICE_LIST_INFO = {
  version: "2026-09-08",
  effectiveFrom: "2026-09-08",
  effectiveTo: "2026-10-06",
  label: "Setembro 2026",
} as const;

export const TERM_LABEL: Record<string, string> = {
  Annual: "Anual",
  "3-Year": "3 anos",
};

export const LICENSE_LABEL: Record<string, string> = {
  "Subscription New": "Nova",
  "Subscription Renewal": "Renovação",
  "Subscription Renewal M2S": "Renovação M2S",
  "Subscription Switch from Category 1": "Switch cat. 1",
  "Subscription Switch from Category 2": "Switch cat. 2",
  "Subscription Switch from M2S": "Switch M2S",
};

export const DEPLOY_LABEL: Record<string, string> = {
  S: "Single-user",
  N: "Multi-user",
  A: "Multi-user (sessão)",
  F: "Flex",
};

export const USAGE_LABEL: Record<string, string> = {
  Commercial: "Comercial",
  "Not For Resale": "NFR",
};
