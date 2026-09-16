from .config import DEFAULT_HUBGOV_PCT, MIN_NET_BRL


def _br(n, decimals=2) -> str:
    s = f"{float(n or 0):,.{decimals}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def compute_odc(items, dollar_rate, discount_pct, client_type, hubgov_credit_pct, credit_used):
    list_total_usd = sum((float(it.get("qty") or 0) * float(it.get("list_price_usd") or 0)) for it in items)
    rate = float(dollar_rate or 0)
    list_total_brl = list_total_usd * rate
    discount_pct = max(0.0, float(discount_pct or 0))
    discount_amount = list_total_brl * (discount_pct / 100)
    after_discount = list_total_brl - discount_amount
    pct = max(0.0, float(hubgov_credit_pct or 0)) if client_type == "governo" else 0.0
    credit_generated = list_total_brl * (pct / 100) if client_type == "governo" else 0.0
    credit_used = max(0.0, float(credit_used or 0))
    net_total_brl = after_discount - credit_used
    below_minimum = credit_used > 0 and net_total_brl < MIN_NET_BRL
    return {
        "list_total_usd": list_total_usd,
        "list_total_brl": list_total_brl,
        "discount_amount": discount_amount,
        "after_discount": after_discount,
        "credit_generated": credit_generated,
        "net_total_brl": net_total_brl,
        "below_minimum": below_minimum,
        "hubgov_credit_pct": pct,
    }


def build_memo(calc, dollar_rate, discount_pct, client_type, credit_used):
    lines = [
        "Memória de Cálculo — Ordem de Compra",
        f"Lista USD: US$ {_br(calc['list_total_usd'])}",
        f"Câmbio do Dia: R$ {_br(dollar_rate, 4)}",
        f"Lista BRL: R$ {_br(calc['list_total_brl'])}",
        f"Desconto ({_br(discount_pct)}%): − R$ {_br(calc['discount_amount'])}",
        f"Após desconto: R$ {_br(calc['after_discount'])}",
    ]
    if client_type == "governo":
        lines.append(
            f"Crédito HubGov gerado ({_br(calc['hubgov_credit_pct'] or DEFAULT_HUBGOV_PCT)}% sobre lista): "
            f"R$ {_br(calc['credit_generated'])}"
        )
    else:
        lines.append("Cliente privado — não gera crédito HubGov.")
    lines.append(f"Crédito utilizado: R$ {_br(credit_used)}")
    lines.append(f"Valor Final: R$ {_br(calc['net_total_brl'])}")
    if calc["below_minimum"]:
        lines.append(f"Atenção: valor final inferior ao mínimo de R$ {_br(MIN_NET_BRL)}.")
    return "\n".join(lines)
