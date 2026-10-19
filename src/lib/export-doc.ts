import { COMPANY, SIGNATURE_IDENTITY } from "./company";
import { LOGO_DATA_URI } from "./logo-data";
import { brl, formatDateBR, usd } from "./utils";
import type { PurchaseOrder, SalesOrder } from "./types";
import { SALES_STATUS_LABEL, SALE_KIND_LABEL, STATUS_LABEL } from "./types";
import { downloadBlob } from "./utils";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function diasPorExtenso(n: number) {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dez = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const abs = Math.abs(Math.trunc(n));
  if (abs === 0) return "zero";
  if (abs === 100) return "cem";
  const c = Math.trunc(abs / 100);
  const r = abs % 100;
  let resto = "";
  if (r < 10) resto = unidades[r];
  else if (r < 20) resto = dez[r - 10];
  else resto = dezenas[Math.trunc(r / 10)] + (r % 10 ? ` e ${unidades[r % 10]}` : "");
  if (c === 0) return resto;
  if (r === 0) return centenas[c];
  return `${centenas[c]} e ${resto}`;
}

function prazoDias(days: number | null | undefined) {
  if (days == null || Number.isNaN(days)) return "—";
  const n = Math.trunc(days);
  return `${n} (${diasPorExtenso(n)}) ${n === 1 ? "dia" : "dias"}`;
}

function creditUsesLabel(order: PurchaseOrder) {
  const lines = order.creditUses?.filter((line) => line.nf || line.amount);
  if (lines?.length) {
    return ` (${lines.map((line) => `NF ${escapeHtml(line.nf)}: ${brl(line.amount)}`).join("; ")})`;
  }
  return order.creditNf ? ` (NF ${escapeHtml(order.creditNf)})` : "";
}

const FONT = "Arial, Helvetica, sans-serif";

const docCss = `
  html, body, p, div, span, td, th, li, a, strong, b, em, pre, h1, h2, h3, table {
    font-family: ${FONT};
    font-size: 11pt;
    color: #1a232d;
    line-height: 1.4;
  }
  body { margin: 32px; }
  p { margin: 0 0 6pt; font-size: 11pt; font-family: ${FONT}; }
  h1 {
    font-family: ${FONT};
    font-size: 14pt;
    font-weight: bold;
    margin: 0 0 6pt;
  }
  h2 {
    font-family: ${FONT};
    font-size: 11pt;
    font-weight: bold;
    border-bottom: 1px solid #cfc7b8;
    padding-bottom: 4pt;
    margin: 18pt 0 8pt;
  }
  .muted { color: #5c6570; font-size: 11pt; font-family: ${FONT}; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; font-family: ${FONT}; }
  th, td {
    border-bottom: 1px solid #e4ddd0;
    padding: 5pt 4pt;
    text-align: left;
    font-size: 11pt;
    font-family: ${FONT};
  }
  th { font-weight: bold; color: #5c6570; }
  .num { text-align: right; }
  .box { border: 1px solid #d4cdc0; padding: 8pt 10pt; margin-top: 6pt; }
  .row { display: flex; gap: 24px; }
  .row > div { flex: 1; }
  .sig-block { width: 100%; margin-top: 28pt; border-collapse: collapse; }
  .sig-block td { border: none; text-align: center; padding: 0; font-size: 11pt; }
  .sig-block .line { border-bottom: 1px solid #1a232d; width: 260pt; height: 48pt; margin: 0 auto 8pt; }
  pre { font-family: ${FONT}; font-size: 11pt; white-space: pre-wrap; margin: 0; }
  .doc-head { width: 100%; border-collapse: collapse; border-bottom: 1pt solid #cfc7b8; margin: 0 0 14pt; }
  .doc-head td { border: none; padding: 0 10pt 10pt 0; vertical-align: middle; font-size: 11pt; }
  .doc-logo { width: 170pt; height: auto; border: 0; }
`;

const wordCss = `
  @page { size: 21cm 29.7cm; margin: 2cm; }
  ${docCss}
  body { margin: 0; }
`;

function signatureBlockHtml() {
  return `
      <h2>Assinatura</h2>
      <table class="sig-block" width="100%">
        <tr>
          <td align="center" style="padding-top:36pt;border:none;text-align:center">
            <p style="margin:0;font-size:11pt;">${escapeHtml(SIGNATURE_IDENTITY.role)}</p>
            <p style="margin:0;font-size:11pt;">${escapeHtml(SIGNATURE_IDENTITY.company)}</p>
            <p style="margin:0;font-size:11pt;">${escapeHtml(SIGNATURE_IDENTITY.cnpjLine)}</p>
          </td>
        </tr>
      </table>`;
}

function documentHeaderHtml(title: string, subtitle: string) {
  return `
    <table class="doc-head" width="100%">
      <tr>
        <td align="center" style="text-align:center;padding-bottom:12pt">
          <img class="doc-logo" src="${LOGO_DATA_URI}" width="220" height="47" alt="Pro-Systems" />
        </td>
      </tr>
    </table>
    <h1>${escapeHtml(title)}</h1>
    <p class="muted">${escapeHtml(subtitle)}</p>`;
}

export function odcDocumentHtml(order: PurchaseOrder, opts?: { includeStatus?: boolean }) {
  const includeStatus = opts?.includeStatus !== false;
  const items = order.items
    .map(
      (it) => `<tr>
        <td>${escapeHtml(it.sku)}</td>
        <td>${escapeHtml(it.productName)}</td>
        <td class="num">${it.qty}</td>
        <td class="num">${usd(it.listPriceUsd)}</td>
        <td class="num">${usd(it.lineTotalUsd)}</td>
        <td class="num">${brl(it.lineTotalBrl)}</td>
      </tr>`,
    )
    .join("");
  const contracts = order.renewalContracts
    ? `<p>Contratos Renovados: ${escapeHtml(order.renewalContracts)}</p>`
    : "";
  const special = order.specialCondition
    ? `<p>Condição especial: ${escapeHtml(order.specialCondition)} — aprovado por ${escapeHtml(order.specialApprovedBy || "—")}</p>`
    : "";

  const subtitle = [
    `Data ${formatDateBR(order.orderDate)}`,
    includeStatus ? (STATUS_LABEL[order.status] ?? order.status) : null,
    `Cliente ${order.clientType === "governo" ? "Governo" : "Privado"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
    <div>
      ${documentHeaderHtml(`Ordem de Compra ${order.number}`, subtitle)}
      <h2>1. Dados do Pedido</h2>
      <div class="box">
        <p>Fornecedor: ${escapeHtml(order.supplierName || "PARS PRODUTOS DE PROCESSAMENTO DE DADOS LTDA")}</p>
        <p>Tipo de Venda: ${escapeHtml(SALE_KIND_LABEL[order.saleKind] ?? order.saleKind)}</p>
        ${contracts}
      </div>
      <h2>2. Produtos Autodesk</h2>
      <table>
        <thead><tr><th>SKU</th><th>Produto</th><th class="num">Qtd</th><th class="num">Unit. USD</th><th class="num">Total USD</th><th class="num">Total BRL</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <div class="box">
        <p>Crédito utilizado${creditUsesLabel(order)}: ${brl(order.creditUsed)}</p>
        <p><strong>Valor Final: ${brl(order.netTotalBrl)}</strong></p>
      </div>
      ${order.notes?.trim() ? `<div class="box"><p>${escapeHtml(order.notes.trim())}</p></div>` : ""}
      <div class="box">
        <p>Entrega das Licenças: ${order.licenseDelivery === "imediato" ? "Imediato" : `Ativação em ${formatDateBR(order.activationDate)}`}</p>
        <p>Prazo de Pagamento: ${prazoDias(order.paymentTermDays)}</p>
        ${special}
      </div>
      <h2>3. Cliente</h2>
      <div class="box">
        <p>CSN: ${escapeHtml(order.clientCsn || "")}</p>
        <p>Nome: ${escapeHtml(order.clientName || "")}</p>
        <p>CNPJ/CPF: ${escapeHtml(order.clientDocument || "")}</p>
        <p>E-mail: ${escapeHtml(order.clientEmail || "—")} · Gestor: ${escapeHtml(order.clientManager || "—")}</p>
        <p>Telefone: ${escapeHtml(order.clientPhone || "—")}</p>
      </div>
      <h2>Faturamento e Cobrança</h2>
      <div class="box">
        <p><strong>${escapeHtml(COMPANY.name)}</strong></p>
        <p>${escapeHtml(COMPANY.addressLine1)}</p>
        <p>${escapeHtml(COMPANY.addressLine2)}</p>
        <p>CNPJ: ${COMPANY.cnpj} · Inscrição Estadual: ${COMPANY.ie}</p>
        <p>Fone: ${COMPANY.phone}</p>
      </div>
      <h2>Observações</h2>
      <div class="box">
        <p>Valor Do Pedido Em Dólar: ${usd(order.listTotalUsd)}</p>
        <p>Dólar Do Dia: R$ ${order.dollarRate.toFixed(4)}</p>
        <p>Valor Do Pedido Em Reais: ${brl(order.listTotalBrl)}</p>
        <p>Valor Total Do Desconto Em Reais: ${brl(order.discountAmount)}</p>
        <p>Valor Total De Créditos Utilizados: ${brl(order.creditUsed)}</p>
      </div>
      ${signatureBlockHtml()}
    </div>
  `;
}

export function salesDocumentHtml(order: SalesOrder) {
  const items = order.items
    .map(
      (it) => `<tr>
        <td>${escapeHtml(it.sku)}</td>
        <td>${escapeHtml(it.productName)}</td>
        <td class="num">${it.qty}</td>
        <td class="num">${brl(it.unitPriceBrl)}</td>
        <td class="num">${brl(it.lineTotalBrl)}</td>
      </tr>`,
    )
    .join("");
  const extra =
    order.clientType === "governo"
      ? `<p>Contrato Administrativo: ${escapeHtml(order.contractNumber || "—")}</p>`
      : `<p>Proposta: ${escapeHtml(order.proposalNumber || "—")} · Aceite: ${formatDateBR(order.acceptanceDate)}</p>`;
  return `
    <div>
      ${documentHeaderHtml(
        `Pedido de Venda ${order.number}`,
        `Data ${formatDateBR(order.orderDate)} · ${SALES_STATUS_LABEL[order.status] ?? order.status} · ODC ${order.purchaseOrderNumber || String(order.purchaseOrderId)}`,
      )}
      <h2>Cliente</h2>
      <div class="box">
        <p>${escapeHtml(order.clientName || "")} · CSN ${escapeHtml(order.clientCsn || "")}</p>
        <p>Tipo: ${order.clientType === "governo" ? "Governo" : "Privado"}</p>
        ${extra}
      </div>
      <h2>Memória de Cálculo (ODC)</h2>
      <div class="box"><pre>${escapeHtml(order.calculationMemo)}</pre></div>
      <h2>Itens de Venda</h2>
      <table>
        <thead><tr><th>SKU</th><th>Produto</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Total</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <div class="box">
        <p>Margem: ${order.marginPct}%</p>
        <p>Vendedor: ${escapeHtml(order.sellerName)}</p>
        <p>Prazo de Pagamento: ${order.paymentTermDays ?? "—"} dias</p>
        <p>Crédito utilizado: ${brl(order.creditUsed)} · Crédito gerado: ${brl(order.creditGenerated)}</p>
        <p><strong>Total da Venda: ${brl(order.saleTotalBrl)}</strong></p>
        <p class="muted">Contato interno (financeiro): ${escapeHtml(order.financeContactName || "—")} · ${escapeHtml(order.financeContact || "")}</p>
      </div>
      ${signatureBlockHtml()}
    </div>
  `;
}

export function downloadWord(filename: string, body: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
</w:WordDocument>
</xml><![endif]-->
<style>
${wordCss}
</style>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a232d; mso-ascii-font-family: Arial; mso-hansi-font-family: Arial; mso-bidi-font-family: Arial;">
${body}
</body>
</html>`;
  downloadBlob(new Blob(["\ufeff", html], { type: "application/msword" }), filename);
}

export function rowsToCsv(rows: Record<string, string>[]) {
  if (!rows.length) return "\ufeff";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(";")];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
        .join(";"),
    );
  }
  return `\ufeff${lines.join("\n")}`;
}

function xml(value: string) {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

/** Planilha que o Excel abre, sem alterar os dados de origem. */
export function rowsToExcel(rows: Record<string, string>[], sheet = "Gestão e Análise") {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const cell = (value: string, header: string) => {
    const money = header.startsWith("Valor") || header.startsWith("Crédito");
    const margin = header === "Margem";
    const n = Number(String(value).replace(",", "."));
    if ((money || margin) && value !== "" && Number.isFinite(n)) {
      return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`;
  };
  const head = headers.map((h) => `<Cell><Data ss:Type="String">${xml(h)}</Data></Cell>`).join("");
  const body = rows
    .map((r) => `<Row>${headers.map((h) => cell(String(r[h] ?? ""), h)).join("")}</Row>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xml(sheet)}"><Table>
<Row>${head}</Row>
${body}
</Table></Worksheet>
</Workbook>`;
}
