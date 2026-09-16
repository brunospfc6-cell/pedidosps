from __future__ import annotations

import base64
import html
from pathlib import Path

from .config import COMPANY, ROOT, SALE_KIND_LABEL, SIGNATURE, STATUS_LABEL

LOGO = ROOT / "frontend" / "img" / "logo-prosystems.png"

UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"]
DEZ_A_DEZENOVE = [
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
]
DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]


def _esc(s) -> str:
    return html.escape("" if s is None else str(s))


def _fmt(v, decimals=2) -> str:
    s = f"{float(v or 0):,.{decimals}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _brl(v) -> str:
    return "R$ " + _fmt(v)


def _usd(v) -> str:
    return "US$ " + _fmt(v)


def _prazo(order) -> str:
    t = (order.get("payment_terms") or "").strip()
    if t:
        return t
    d = order.get("payment_term_days")
    if d in (None, ""):
        return "—"
    return f"{d} dias"


def _qty(v) -> str:
    n = float(v or 0)
    if n.is_integer():
        return str(int(n))
    return _fmt(n)



def _date(iso: str | None) -> str:
    if not iso:
        return "—"
    p = iso[:10].split("-")
    if len(p) != 3:
        return iso
    return f"{p[2]}/{p[1]}/{p[0]}"


def _logo_uri() -> str:
    if not LOGO.exists():
        return ""
    b64 = base64.b64encode(LOGO.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _centena(n: int) -> str:
    n = int(n)
    if n == 0:
        return ""
    if n == 100:
        return "cem"
    c, r = divmod(n, 100)
    if r == 0:
        return CENTENAS[c]
    if r < 10:
        resto = UNIDADES[r]
    elif r < 20:
        resto = DEZ_A_DEZENOVE[r - 10]
    else:
        d, u = divmod(r, 10)
        resto = DEZENAS[d] + (f" e {UNIDADES[u]}" if u else "")
    if c == 0:
        return resto
    return f"{CENTENAS[c]} e {resto}"


def _inteiro(n: int) -> str:
    n = int(n)
    if n == 0:
        return "zero"
    partes = []
    last = 0
    milhoes, resto = divmod(n, 1_000_000)
    milhares, unidades = divmod(resto, 1000)
    if milhoes:
        if milhoes == 1:
            partes.append("um milhão")
        else:
            partes.append(f"{_centena(milhoes)} milhões")
        last = milhoes
    if milhares:
        if milhares == 1:
            partes.append("mil")
        else:
            partes.append(f"{_centena(milhares)} mil")
        last = milhares
    if unidades:
        partes.append(_centena(unidades))
        last = unidades
    if len(partes) == 1:
        return partes[0]
    if last < 100 or last % 100 == 0:
        return ", ".join(partes[:-1]) + " e " + partes[-1]
    return ", ".join(partes)



def reais_extenso(v) -> str:
    n = round(abs(float(v or 0)), 2)
    reais = int(n)
    centavos = int(round((n - reais) * 100))
    if reais == 0:
        txt_reais = "zero reais"
    elif reais == 1:
        txt_reais = "um real"
    else:
        corpo = _inteiro(reais)
        if reais >= 1_000_000 and reais % 1_000_000 == 0:
            txt_reais = f"{corpo} de reais"
        else:
            txt_reais = f"{corpo} reais"
    if centavos == 0:
        txt = txt_reais
    elif centavos == 1:
        txt = f"{txt_reais} e um centavo"
    else:
        txt = f"{txt_reais} e {_inteiro(centavos)} centavos"
    if float(v or 0) < 0:
        txt = "menos " + txt
    return txt


CSS = """
  html, body, p, div, span, td, th, table, h1, h2, pre {
    font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a232d; line-height: 1.4;
  }
  h1 { font-size: 14pt; font-weight: bold; margin: 0 0 6pt; }
  h2 { font-size: 11pt; font-weight: bold; border-bottom: 1px solid #cfc7b8; padding-bottom: 4pt; margin: 18pt 0 8pt; }
  .muted { color: #5c6570; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e4ddd0; padding: 5pt 4pt; text-align: left; }
  th { font-weight: bold; color: #5c6570; }
  .num { text-align: right; }
  .box { border: 1px solid #d4cdc0; padding: 8pt 10pt; margin-top: 6pt; }
  .doc-head { width: 100%; border-collapse: collapse; margin: 0 0 14pt; }
  .doc-head td { border: none; padding: 0 0 12pt 0; text-align: center; vertical-align: middle; }
"""


def _header(title: str, subtitle: str) -> str:
    logo = _logo_uri()
    img = f'<img src="{logo}" width="220" height="47" alt="Pro-Systems" />' if logo else ""
    return f"""
    <table class="doc-head" width="100%">
      <tr>
        <td align="center" style="text-align:center;padding-bottom:12pt">{img}</td>
      </tr>
    </table>
    <h1>{_esc(title)}</h1>
    <p class="muted">{_esc(subtitle)}</p>
    """


def _signature() -> str:
    return f"""
    <h2>Assinatura</h2>
    <table width="100%"><tr><td align="center" style="border:none;padding-top:24pt;text-align:center">
      <p style="margin:0">{_esc(SIGNATURE['role'])}</p>
      <p style="margin:0">{_esc(SIGNATURE['company'])}</p>
      <p style="margin:0">{_esc(SIGNATURE['cnpjLine'])}</p>
    </td></tr></table>
    """


def odc_html(order: dict, items: list[dict], include_status: bool = False) -> str:
    rows = "".join(
        f"<tr><td>{_esc(it['sku'])}</td><td>{_esc(it['product_name'])}</td>"
        f"<td class='num'>{_qty(it['qty'])}</td><td class='num'>{_usd(it['list_price_usd'])}</td>"
        f"<td class='num'>{_usd(it['line_total_usd'])}</td><td class='num'>{_brl(it['line_total_brl'])}</td></tr>"
        for it in items
    )
    bits = [f"Data {_date(order['order_date'])}"]
    if include_status:
        bits.append(STATUS_LABEL.get(order["status"], order["status"]))
    bits.append("Cliente Governo" if order["client_type"] == "governo" else "Cliente Privado")
    contracts = (
        f"<p>Contratos Renovados: {_esc(order.get('renewal_contracts'))}</p>"
        if order.get("renewal_contracts")
        else ""
    )
    nf = f" (NF {_esc(order.get('credit_nf'))})" if order.get("credit_nf") else ""
    net = order.get("net_total_brl") or 0
    return f"""
    <div>
      {_header(f"Ordem de Compra {order['number']}", " · ".join(bits))}
      <h2>1. Dados do Pedido</h2>
      <div class="box">
        <p>Fornecedor: {_esc(order.get('supplier_name') or COMPANY['name'])}</p>
        <p>Tipo de Venda: {_esc(SALE_KIND_LABEL.get(order.get('sale_kind'), order.get('sale_kind')))}</p>
        {contracts}
      </div>
      <h2>2. Produtos Autodesk</h2>
      <table>
        <thead><tr><th>SKU</th><th>Produto</th><th class="num">Qtd</th>
        <th class="num">Unit. USD</th><th class="num">Total USD</th><th class="num">Total BRL</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div class="box">
        <p>Crédito utilizado{nf}: {_brl(order.get('credit_used'))}</p>
        <p><strong>Valor Final: {_brl(net)}</strong></p>
        <p>Valor Final por extenso: {_esc(reais_extenso(net))}</p>
      </div>
      <div class="box">
        <p>Câmbio do Dia: R$ {_fmt(order['dollar_rate'], 4)}</p>
        <p>Lista BRL: {_brl(order['list_total_brl'])}</p>
        <p>Desconto {_fmt(order['discount_pct'])}%: − {_brl(order['discount_amount'])}</p>
        <p>Crédito HubGov gerado ({_fmt(order['hubgov_credit_pct'])}% sobre lista): {_brl(order['credit_generated'])}</p>
        <p>Entrega das Licenças: {"Imediato" if order.get("license_delivery") == "imediato" else "Ativação em " + _date(order.get("activation_date"))}</p>
        <p>Prazo de Pagamento: {_esc(_prazo(order))}</p>
      </div>
      <h2>3. Cliente</h2>
      <div class="box">
        <p>CSN: {_esc(order.get("client_csn"))}</p>
        <p>Nome: {_esc(order.get("client_name"))}</p>
        <p>CNPJ/CPF: {_esc(order.get("client_document"))}</p>
        <p>E-mail: {_esc(order.get("client_email") or "—")} · Gestor: {_esc(order.get("client_manager") or "—")}</p>
        <p>Telefone: {_esc(order.get("client_phone") or "—")}</p>
      </div>
      <h2>Faturamento e Cobrança</h2>
      <div class="box">
        <p><strong>{_esc(COMPANY['name'])}</strong></p>
        <p>{_esc(COMPANY['addressLine1'])}</p>
        <p>{_esc(COMPANY['addressLine2'])}</p>
        <p>CNPJ: {COMPANY['cnpj']} · Inscrição Estadual: {COMPANY['ie']}</p>
        <p>Fone: {COMPANY['phone']}</p>
      </div>
      {_signature()}
    </div>
    """


def sales_html(order: dict, items: list[dict]) -> str:
    rows = "".join(
        f"<tr><td>{_esc(it['sku'])}</td><td>{_esc(it['product_name'])}</td>"
        f"<td class='num'>{_qty(it['qty'])}</td><td class='num'>{_brl(it['unit_price_brl'])}</td>"
        f"<td class='num'>{_brl(it['line_total_brl'])}</td></tr>"
        for it in items
    )
    extra = (
        f"<p>Contrato Administrativo: {_esc(order.get('contract_number') or '—')}</p>"
        if order.get("client_type") == "governo"
        else f"<p>Proposta: {_esc(order.get('proposal_number') or '—')} · Aceite: {_date(order.get('acceptance_date'))}</p>"
    )
    origin = order.get("contact_origin") or "—"
    total = order.get("sale_total_brl") or 0
    return f"""
    <div>
      {_header(f"Pedido de Venda {order['number']}", f"Data {_date(order['order_date'])} · ODC {_esc(order.get('purchase_order_number') or '')}")}
      <h2>Cliente</h2>
      <div class="box">
        <p>{_esc(order.get('client_name'))} · CSN {_esc(order.get('client_csn'))}</p>
        <p>Tipo: {"Governo" if order.get("client_type") == "governo" else "Privado"}</p>
        <p>Origem do Contato: {_esc(origin)}</p>
        {extra}
      </div>
      <h2>Memória de Cálculo (ODC)</h2>
      <div class="box"><pre>{_esc(order.get("calculation_memo") or "")}</pre></div>
      <h2>Itens de Venda</h2>
      <table>
        <thead><tr><th>SKU</th><th>Produto</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Total</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div class="box">
        <p>Margem: {_fmt(order.get("margin_pct"))}%</p>
        <p>Vendedor: {_esc(order.get("seller_name"))}</p>
        <p>Prazo de Pagamento: {_esc(_prazo(order))}</p>
        <p>Crédito utilizado: {_brl(order.get("credit_used"))} · Crédito gerado: {_brl(order.get("credit_generated"))}</p>
        <p><strong>Valor Final: {_brl(total)}</strong></p>
        <p>Valor Final por extenso: {_esc(reais_extenso(total))}</p>
      </div>
      {_signature()}
    </div>
    """


def as_word(body: str) -> bytes:
    html_doc = f"""<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><style>{CSS}</style></head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 11pt;">{body}</body></html>"""
    return ("\ufeff" + html_doc).encode("utf-8")
