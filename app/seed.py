from __future__ import annotations

import json
from datetime import date

from .config import PARS, ROOT
from . import db
from .calc import compute_odc
from .security import hash_password


def seed_if_empty():
    conn = db.get_conn()
    users = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    if users == 0:
        samples = [
            ("Administrador Pro-Systems", "olivia.t@example.org", "Admin@123", "administrador"),
            ("Vendedor Demo", "ivan.p@example.net", "Vendedor@123", "vendedor"),
            ("Diretor Demo", "rachel.c@example.org", "Diretor@123", "diretor"),
        ]
        for name, email, password, role in samples:
            conn.execute(
                "INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,1)",
                (name, email.lower(), hash_password(password), role),
            )

    pars = conn.execute("SELECT id FROM suppliers WHERE cnpj = ?", (PARS["cnpj"],)).fetchone()
    if not pars:
        conn.execute(
            "INSERT INTO suppliers (name, cnpj, city, state, active) VALUES (?,?,?,?,1)",
            (PARS["name"], PARS["cnpj"], PARS["city"], PARS["state"]),
        )

    products = conn.execute("SELECT COUNT(*) AS n FROM products").fetchone()["n"]
    if products == 0:
        price_path = ROOT / "seed" / "price-list.json"
        if price_path.exists():
            data = json.loads(price_path.read_text(encoding="utf-8"))
            items = data.get("items") or []
            conn.executemany(
                """INSERT OR IGNORE INTO products
                   (sku, name, category, sap_name, product_line, usage_type, license_type,
                    contract_term, deployment, notes, list_price_usd, active, source)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'price_list')""",
                [
                    (
                        it.get("sku"),
                        it.get("name"),
                        it.get("group") or "Autodesk",
                        it.get("sap") or "",
                        it.get("line") or "",
                        it.get("usage") or "Commercial",
                        it.get("license") or "",
                        it.get("term") or "",
                        it.get("deploy") or "",
                        it.get("notes") or "",
                        float(it.get("price") or 0),
                        1,
                    )
                    for it in items
                    if it.get("sku")
                ],
            )

    clients = conn.execute("SELECT COUNT(*) AS n FROM clients").fetchone()["n"]
    if clients == 0:
        admin = conn.execute("SELECT id FROM users WHERE role = 'administrador' LIMIT 1").fetchone()
        uid = admin["id"] if admin else 1
        conn.execute(
            """INSERT INTO clients (csn, name, document, email, manager_name, phone, created_by)
               VALUES (?,?,?,?,?,?,?)""",
            (
                "GOV-001",
                "Prefeitura de Brasília — Secretaria de Obras",
                "00.394.460/0001-41",
                "olivia.t@example.org",
                "Ana Souza",
                "61-3225-0000",
                uid,
            ),
        )
        conn.execute(
            """INSERT INTO clients (csn, name, document, email, manager_name, phone, created_by)
               VALUES (?,?,?,?,?,?,?)""",
            (
                "PVT-100",
                "Construtora Planalto Ltda.",
                "12.345.678/0001-90",
                "george.a@example.org",
                "Carlos Mendes",
                "61-3333-4400",
                uid,
            ),
        )

    if conn.execute("SELECT COUNT(*) AS n FROM purchase_orders").fetchone()["n"] == 0:
        prod = conn.execute(
            """SELECT * FROM products WHERE active=1 AND list_price_usd > 10
               AND (license_type LIKE '%New%' OR license_type LIKE '%new%')
               ORDER BY id LIMIT 1"""
        ).fetchone()
        if not prod:
            prod = conn.execute(
                "SELECT * FROM products WHERE active=1 AND list_price_usd > 0 ORDER BY id LIMIT 1"
            ).fetchone()
        supplier = conn.execute("SELECT id FROM suppliers LIMIT 1").fetchone()
        client = conn.execute("SELECT * FROM clients WHERE csn = 'GOV-001'").fetchone()
        admin = conn.execute("SELECT * FROM users WHERE role = 'administrador' LIMIT 1").fetchone()
        if prod and supplier and client and admin:
            qty = 2
            items = [{"qty": qty, "list_price_usd": prod["list_price_usd"]}]
            calc = compute_odc(items, 5.20, 0, "governo", 8, 0)
            conn.execute("UPDATE document_counters SET last_value = 1 WHERE name = 'odc'")
            cur = conn.execute(
                """INSERT INTO purchase_orders (
                     number, seq, order_date, supplier_id, client_type, sale_kind, status,
                     dollar_rate, discount_pct, hubgov_credit_pct, license_delivery,
                     payment_term_days, credit_used, client_id, client_csn, client_name,
                     client_document, client_email, client_manager, client_phone,
                     list_total_usd, list_total_brl, discount_amount, net_total_brl,
                     credit_generated, created_by
                   ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    "ODC-000001",
                    1,
                    date.today().isoformat(),
                    supplier["id"],
                    "governo",
                    "nova",
                    "pendente_envio",
                    5.20,
                    0,
                    8,
                    "imediato",
                    30,
                    0,
                    client["id"],
                    client["csn"],
                    client["name"],
                    client["document"],
                    client["email"],
                    client["manager_name"],
                    client["phone"],
                    calc["list_total_usd"],
                    calc["list_total_brl"],
                    calc["discount_amount"],
                    calc["net_total_brl"],
                    calc["credit_generated"],
                    admin["id"],
                ),
            )
            odc_id = cur.lastrowid
            line_usd = qty * float(prod["list_price_usd"])
            conn.execute(
                """INSERT INTO purchase_order_items
                   (purchase_order_id, product_id, product_name, sku, qty, list_price_usd, line_total_usd, line_total_brl)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (
                    odc_id,
                    prod["id"],
                    prod["name"],
                    prod["sku"],
                    qty,
                    prod["list_price_usd"],
                    line_usd,
                    line_usd * 5.20,
                ),
            )
            conn.execute(
                """INSERT INTO hubgov_ledger (client_id, purchase_order_id, kind, amount, created_by)
                   VALUES (?,?, 'generated', ?, ?)""",
                (client["id"], odc_id, calc["credit_generated"], admin["id"]),
            )

    conn.commit()
