from __future__ import annotations

import re
from datetime import date

from fastapi import HTTPException

from . import db
from .calc import build_memo, compute_odc
from .config import CONTACT_ORIGINS, DEFAULT_HUBGOV_PCT, MIN_NET_BRL


def normalize_terms(data, default_days=30):
    text = (data.get("payment_terms") or "").strip()
    days = data.get("payment_term_days")
    try:
        days = int(days) if days not in (None, "") else None
    except (TypeError, ValueError):
        days = None
    if not text and days:
        text = f"{days} dias"
    if days is None:
        m = re.search(r"\d+", text or "")
        days = int(m.group(0)) if m else default_days
    return text, days


def flag_prorata(data) -> int:
    v = data.get("prorata")
    return 1 if v in (True, 1, "1", "true", "on", "yes") else 0


def pad(n: int, width: int = 6) -> str:
    return str(n).zfill(width)


def next_number(conn, name: str) -> tuple[int, str]:
    conn.execute("UPDATE document_counters SET last_value = last_value + 1 WHERE name = ?", (name,))
    seq = conn.execute("SELECT last_value FROM document_counters WHERE name = ?", (name,)).fetchone()["last_value"]
    prefix = "ODC" if name == "odc" else "PV"
    return seq, f"{prefix}-{pad(seq)}"


def preview_number(conn, name: str) -> str:
    last = conn.execute("SELECT last_value FROM document_counters WHERE name = ?", (name,)).fetchone()
    nxt = (last["last_value"] if last else 0) + 1
    prefix = "ODC" if name == "odc" else "PV"
    return f"{prefix}-{pad(nxt)}"


def upsert_client(conn, user_id: int, data: dict) -> int:
    csn = (data.get("client_csn") or "").strip()
    existing = conn.execute("SELECT id FROM clients WHERE lower(csn) = lower(?)", (csn,)).fetchone()
    fields = (
        data.get("client_name", "").strip(),
        data.get("client_document", "").strip(),
        (data.get("client_email") or "").strip() or None,
        (data.get("client_manager") or "").strip() or None,
        (data.get("client_phone") or "").strip() or None,
    )
    if existing:
        conn.execute(
            """UPDATE clients SET name=?, document=?, email=?, manager_name=?, phone=?,
               updated_at=datetime('now') WHERE id=?""",
            (*fields, existing["id"]),
        )
        return existing["id"]
    cur = conn.execute(
        """INSERT INTO clients (csn, name, document, email, manager_name, phone, created_by)
           VALUES (?,?,?,?,?,?,?)""",
        (csn, *fields, user_id),
    )
    return cur.lastrowid


def validate_odc(data: dict, calc: dict, finalize: bool):
    if finalize and calc["below_minimum"]:
        raise HTTPException(400, f"O valor líquido não pode ser inferior a R$ {MIN_NET_BRL:.2f} ao utilizar crédito HubGov.")
    if data.get("client_type") == "governo" and finalize and float(data.get("hubgov_credit_pct") or 0) < 8:
        raise HTTPException(400, "Pedidos de governo devem gerar no mínimo 8% de crédito HubGov.")
    if float(data.get("credit_used") or 0) > 0 and not (data.get("credit_nf") or "").strip():
        raise HTTPException(400, "Informe a nota fiscal que gerou o crédito HubGov utilizado.")
    if data.get("license_delivery") == "agendada" and not data.get("activation_date"):
        raise HTTPException(400, "Informe a data de ativação das licenças.")
    if data.get("sale_kind") == "renovacao" and not (data.get("renewal_contracts") or "").strip():
        raise HTTPException(400, "Informe o(s) número(s) de contrato que está(ão) sendo renovado(s).")
    if not data.get("items"):
        raise HTTPException(400, "Inclua ao menos um produto.")
    if not (data.get("client_csn") and data.get("client_name") and data.get("client_document")):
        raise HTTPException(400, "Informe CSN, nome e documento do cliente.")
    if float(data.get("dollar_rate") or 0) <= 0:
        raise HTTPException(400, "Informe o câmbio do dia.")


def odc_with_items(conn, odc_id: int) -> dict | None:
    order = db.one(
        conn.execute(
            """SELECT po.*, s.name AS supplier_name
               FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
               WHERE po.id = ?""",
            (odc_id,),
        )
    )
    if not order:
        return None
    order["items"] = db.rows(
        conn.execute("SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id", (odc_id,))
    )
    return order


def sales_with_items(conn, so_id: int) -> dict | None:
    order = db.one(
        conn.execute(
            """SELECT so.*, po.number AS purchase_order_number, po.client_name, po.client_csn, po.client_document
               FROM sales_orders so JOIN purchase_orders po ON po.id = so.purchase_order_id
               WHERE so.id = ?""",
            (so_id,),
        )
    )
    if not order:
        return None
    order["items"] = db.rows(
        conn.execute("SELECT * FROM sales_order_items WHERE sales_order_id = ? ORDER BY id", (so_id,))
    )
    return order


def save_odc(conn, user: dict, data: dict) -> dict:
    items = data.get("items") or []
    hub = float(data.get("hubgov_credit_pct") or 0)
    if data.get("client_type") == "governo" and hub <= 0:
        hub = DEFAULT_HUBGOV_PCT
        data["hubgov_credit_pct"] = hub
    calc = compute_odc(
        items,
        data.get("dollar_rate"),
        data.get("discount_pct"),
        data.get("client_type"),
        hub,
        data.get("credit_used"),
    )
    finalize = bool(data.get("finalize"))
    validate_odc(data, calc, finalize)
    odc_id = data.get("id")
    status = "pendente_envio" if finalize else "rascunho"
    client_id = upsert_client(conn, user["id"], data)
    terms, days = normalize_terms(data)
    prorata = flag_prorata(data)

    if odc_id:
        existing = db.one(conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (odc_id,)))
        if not existing:
            raise HTTPException(404, "Ordem não encontrada.")
        if existing["status"] in ("enviado_pars", "cancelado"):
            raise HTTPException(400, "Esta ordem não pode mais ser alterada.")
        if user["role"] == "vendedor" and existing["created_by"] != user["id"]:
            raise HTTPException(403, "Sem permissão.")
        conn.execute(
            """UPDATE purchase_orders SET
               order_date=?, supplier_id=?, client_type=?, sale_kind=?, status=?,
               dollar_rate=?, discount_pct=?, hubgov_credit_pct=?, license_delivery=?,
               activation_date=?, payment_term_days=?, payment_terms=?, prorata=?,
               credit_used=?, credit_nf=?,
               special_condition=?, special_approved_by=?, client_id=?, client_csn=?,
               client_name=?, client_document=?, client_email=?, client_manager=?,
               client_phone=?, renewal_contracts=?, notes=?,
               list_total_usd=?, list_total_brl=?, discount_amount=?, net_total_brl=?,
               credit_generated=?, updated_at=datetime('now')
               WHERE id=?""",
            (
                data["order_date"], data["supplier_id"], data["client_type"], data["sale_kind"], status,
                data["dollar_rate"], data.get("discount_pct") or 0, hub,
                data.get("license_delivery") or "imediato", data.get("activation_date"),
                days, terms, prorata, data.get("credit_used") or 0,
                data.get("credit_nf"), data.get("special_condition"), data.get("special_approved_by"),
                client_id, data["client_csn"].strip(), data["client_name"].strip(),
                data["client_document"].strip(), data.get("client_email"), data.get("client_manager"),
                data.get("client_phone"), data.get("renewal_contracts"), data.get("notes"),
                calc["list_total_usd"], calc["list_total_brl"], calc["discount_amount"],
                calc["net_total_brl"], calc["credit_generated"], odc_id,
            ),
        )
        conn.execute("DELETE FROM purchase_order_items WHERE purchase_order_id = ?", (odc_id,))
    else:
        seq, number = next_number(conn, "odc")
        cur = conn.execute(
            """INSERT INTO purchase_orders (
                 number, seq, order_date, supplier_id, client_type, sale_kind, status,
                 dollar_rate, discount_pct, hubgov_credit_pct, license_delivery, activation_date,
                 payment_term_days, payment_terms, prorata, credit_used, credit_nf, special_condition, special_approved_by,
                 client_id, client_csn, client_name, client_document, client_email, client_manager,
                 client_phone, renewal_contracts, notes, list_total_usd, list_total_brl,
                 discount_amount, net_total_brl, credit_generated, created_by
               ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                number, seq, data["order_date"], data["supplier_id"], data["client_type"],
                data["sale_kind"], status, data["dollar_rate"], data.get("discount_pct") or 0, hub,
                data.get("license_delivery") or "imediato", data.get("activation_date"),
                days, terms, prorata, data.get("credit_used") or 0,
                data.get("credit_nf"), data.get("special_condition"), data.get("special_approved_by"),
                client_id, data["client_csn"].strip(), data["client_name"].strip(),
                data["client_document"].strip(), data.get("client_email"), data.get("client_manager"),
                data.get("client_phone"), data.get("renewal_contracts"), data.get("notes"),
                calc["list_total_usd"], calc["list_total_brl"], calc["discount_amount"],
                calc["net_total_brl"], calc["credit_generated"], user["id"],
            ),
        )
        odc_id = cur.lastrowid

    for it in items:
        qty = float(it["qty"])
        price = float(it["list_price_usd"])
        line_usd = qty * price
        line_brl = line_usd * float(data["dollar_rate"])
        conn.execute(
            """INSERT INTO purchase_order_items
               (purchase_order_id, product_id, product_name, sku, qty, list_price_usd, line_total_usd, line_total_brl)
               VALUES (?,?,?,?,?,?,?,?)""",
            (odc_id, it.get("product_id"), it["product_name"], it.get("sku"), qty, price, line_usd, line_brl),
        )

    conn.execute("DELETE FROM hubgov_ledger WHERE purchase_order_id = ?", (odc_id,))
    if finalize and data.get("client_type") == "governo" and calc["credit_generated"] > 0:
        conn.execute(
            """INSERT INTO hubgov_ledger (client_id, purchase_order_id, kind, amount, created_by)
               VALUES (?,?, 'generated', ?, ?)""",
            (client_id, odc_id, calc["credit_generated"], user["id"]),
        )
    if finalize and float(data.get("credit_used") or 0) > 0:
        conn.execute(
            """INSERT INTO hubgov_ledger (client_id, purchase_order_id, kind, amount, nf_number, created_by)
               VALUES (?,?, 'used', ?, ?, ?)""",
            (client_id, odc_id, data.get("credit_used") or 0, data.get("credit_nf"), user["id"]),
        )
    return odc_with_items(conn, odc_id)


def mark_sent(conn, user: dict, odc_id: int):
    order = db.one(conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (odc_id,)))
    if not order:
        raise HTTPException(404, "Ordem não encontrada.")
    if order["status"] != "pendente_envio":
        raise HTTPException(400, "Só é possível confirmar envio de ordem pendente.")
    if user["role"] == "vendedor" and order["created_by"] != user["id"]:
        raise HTTPException(403, "Sem permissão.")
    conn.execute(
        "UPDATE purchase_orders SET status='enviado_pars', sent_at=datetime('now') WHERE id=?",
        (odc_id,),
    )
    return odc_with_items(conn, odc_id)


def cancel_odc(conn, user: dict, odc_id: int):
    order = db.one(conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (odc_id,)))
    if not order:
        raise HTTPException(404, "Ordem não encontrada.")
    if order["status"] == "cancelado":
        raise HTTPException(400, "Já cancelada.")
    conn.execute("DELETE FROM hubgov_ledger WHERE purchase_order_id = ?", (odc_id,))
    conn.execute("UPDATE purchase_orders SET status='cancelado', updated_at=datetime('now') WHERE id=?", (odc_id,))
    conn.execute("UPDATE sales_orders SET status='cancelado', updated_at=datetime('now') WHERE purchase_order_id=?", (odc_id,))
    return odc_with_items(conn, odc_id)


def save_sales(conn, user: dict, data: dict) -> dict:
    po = odc_with_items(conn, int(data["purchase_order_id"]))
    if not po:
        raise HTTPException(404, "Ordem de compra não encontrada.")
    if po["status"] == "cancelado":
        raise HTTPException(400, "A ordem de compra está cancelada.")
    items = data.get("items") or []
    if not items:
        raise HTTPException(400, "Informe os valores de venda.")
    if data.get("client_type") == "governo" and not (data.get("contract_number") or "").strip():
        raise HTTPException(400, "Informe o número do contrato administrativo.")
    if data.get("client_type") == "privado" and not (data.get("proposal_number") or "").strip():
        raise HTTPException(400, "Informe o número da proposta.")
    origin = (data.get("contact_origin") or "").strip()
    if origin not in CONTACT_ORIGINS:
        raise HTTPException(400, "Informe a origem do contato.")
    terms, days = normalize_terms(data, default_days=po.get("payment_term_days") or 30)
    if not terms:
        terms = (po.get("payment_terms") or "").strip() or (f"{days} dias" if days else "")
    prorata = flag_prorata(data)
    sale_total = sum(float(it["qty"]) * float(it["unit_price_brl"]) for it in items)
    memo = data.get("calculation_memo") or build_memo(
        compute_odc(
            po["items"], po["dollar_rate"], po["discount_pct"], po["client_type"],
            po["hubgov_credit_pct"], po["credit_used"],
        ),
        po["dollar_rate"], po["discount_pct"], po["client_type"], po["credit_used"],
    )
    so_id = data.get("id")
    if so_id:
        existing = db.one(conn.execute("SELECT * FROM sales_orders WHERE id = ?", (so_id,)))
        if not existing:
            raise HTTPException(404, "Pedido não encontrado.")
        if existing["status"] == "cancelado":
            raise HTTPException(400, "Pedido cancelado.")
        conn.execute(
            """UPDATE sales_orders SET order_date=?, client_type=?, contract_number=?, proposal_number=?,
               acceptance_date=?, margin_pct=?, seller_name=?, finance_contact_name=?, finance_contact=?,
               contact_origin=?, payment_term_days=?, payment_terms=?, prorata=?, calculation_memo=?,
               credit_used=?, credit_generated=?, sale_total_brl=?, updated_at=datetime('now') WHERE id=?""",
            (
                data["order_date"], data["client_type"], data.get("contract_number"), data.get("proposal_number"),
                data.get("acceptance_date"), data.get("margin_pct") or 0, data.get("seller_name") or user["name"],
                data.get("finance_contact_name"), data.get("finance_contact"), origin,
                days, terms, prorata, memo, po["credit_used"], po["credit_generated"], sale_total, so_id,
            ),
        )
        conn.execute("DELETE FROM sales_order_items WHERE sales_order_id = ?", (so_id,))
    else:
        seq, number = next_number(conn, "pv")
        cur = conn.execute(
            """INSERT INTO sales_orders (
                 number, seq, purchase_order_id, order_date, client_type, contract_number, proposal_number,
                 acceptance_date, margin_pct, seller_id, seller_name, finance_contact_name, finance_contact,
                 contact_origin, payment_term_days, payment_terms, prorata, calculation_memo, credit_used,
                 credit_generated, sale_total_brl, created_by
               ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                number, seq, po["id"], data["order_date"], data["client_type"], data.get("contract_number"),
                data.get("proposal_number"), data.get("acceptance_date"), data.get("margin_pct") or 0,
                user["id"], data.get("seller_name") or user["name"], data.get("finance_contact_name"),
                data.get("finance_contact"), origin, days, terms, prorata, memo, po["credit_used"],
                po["credit_generated"], sale_total, user["id"],
            ),
        )
        so_id = cur.lastrowid
    for it in items:
        qty = float(it["qty"])
        unit = float(it["unit_price_brl"])
        conn.execute(
            """INSERT INTO sales_order_items (sales_order_id, product_name, sku, qty, unit_price_brl, line_total_brl)
               VALUES (?,?,?,?,?,?)""",
            (so_id, it["product_name"], it.get("sku"), qty, unit, qty * unit),
        )
    return sales_with_items(conn, so_id)


def cancel_sales(conn, user: dict, so_id: int):
    order = db.one(conn.execute("SELECT * FROM sales_orders WHERE id = ?", (so_id,)))
    if not order:
        raise HTTPException(404, "Pedido não encontrado.")
    conn.execute("UPDATE sales_orders SET status='cancelado', updated_at=datetime('now') WHERE id=?", (so_id,))
    return sales_with_items(conn, so_id)


def credit_summary(conn) -> dict:
    gen = conn.execute(
        "SELECT COALESCE(SUM(amount),0) AS n FROM hubgov_ledger WHERE kind='generated'"
    ).fetchone()["n"]
    used = conn.execute(
        "SELECT COALESCE(SUM(amount),0) AS n FROM hubgov_ledger WHERE kind='used'"
    ).fetchone()["n"]
    return {"generated": gen, "used": used, "remaining": gen - used}


def available_credits(conn) -> list[dict]:
    return db.rows(
        conn.execute(
            """SELECT nf_number AS nf,
                      SUM(CASE WHEN kind='generated' THEN amount ELSE 0 END)
                    - SUM(CASE WHEN kind='used' THEN amount ELSE 0 END) AS remaining
               FROM hubgov_ledger
               WHERE nf_number IS NOT NULL AND nf_number <> ''
               GROUP BY nf_number
               HAVING remaining > 0"""
        )
    )
