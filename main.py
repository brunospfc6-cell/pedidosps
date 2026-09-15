from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response as FastResponse
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app import db
from app.calc import compute_odc
from app.config import HOST, PORT, ROLE_LABEL
from app.export_doc import as_word, odc_html, sales_html
from app.pricelist import get_meta as catalog_meta, list_imports, save_upload_and_apply
from app.seed import seed_if_empty
from app.security import clear_session, current_user, hash_password, set_session_cookie, verify_password
from app import services
from app import updater

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
NO_STORE = {"Cache-Control": "no-store"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_db()
    seed_if_empty()
    yield


app = FastAPI(title="Pro-Systems Compras e Vendas", lifespan=lifespan)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


def user_out(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["name"],
        "email": u["email"],
        "role": u["role"],
        "role_label": ROLE_LABEL.get(u["role"], u["role"]),
        "active": bool(u["active"]),
    }


@app.exception_handler(HTTPException)
async def http_exc(_, exc: HTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


def require_admin(request: Request) -> dict:
    u = current_user(request)
    if u["role"] != "administrador":
        raise HTTPException(403, "Somente o administrador.")
    return u


@app.get("/api/health")
def health():
    try:
        meta = catalog_meta()
    except Exception:
        meta = {}
    return {"ok": True, "app": "pro-systems", "catalog": meta.get("label") if isinstance(meta, dict) else None}


# ── Auth ──────────────────────────────────────────────
@app.post("/api/auth/login")
def login(payload: dict, response: Response):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    row = db.one(db.get_conn().execute("SELECT * FROM users WHERE lower(email)=?", (email,)))
    if not row or not row["active"] or not verify_password(password, row["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos.")
    set_session_cookie(response, row["id"])
    return user_out(row)


@app.post("/api/auth/logout")
def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(request: Request):
    return user_out(current_user(request))


# ── Users ─────────────────────────────────────────────
@app.get("/api/users")
def list_users(request: Request):
    u = current_user(request)
    if u["role"] != "administrador":
        raise HTTPException(403, "Somente o administrador gerencia usuários.")
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "email": r["email"],
            "role": r["role"],
            "role_label": ROLE_LABEL.get(r["role"], r["role"]),
            "active": bool(r["active"]),
            "created_at": r["created_at"],
        }
        for r in db.rows(db.get_conn().execute("SELECT id, name, email, role, active, created_at FROM users ORDER BY id"))
    ]


@app.post("/api/users")
def create_user(request: Request, payload: dict):
    u = current_user(request)
    if u["role"] != "administrador":
        raise HTTPException(403, "Somente o administrador gerencia usuários.")
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = payload.get("role") or "vendedor"
    if len(name) < 2 or "@" not in email or len(password) < 6:
        raise HTTPException(400, "Informe nome, e-mail e senha (mín. 6 caracteres).")
    if role not in ("administrador", "vendedor", "diretor"):
        raise HTTPException(400, "Perfil inválido.")
    try:
        with db.tx() as conn:
            conn.execute(
                "INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,1)",
                (name, email, hash_password(password), role),
            )
            uid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Já existe um usuário com este e-mail.")
    return {"id": uid, "email": email}


@app.post("/api/users/{user_id}")
def update_user(request: Request, user_id: int, payload: dict):
    u = current_user(request)
    if u["role"] != "administrador":
        raise HTTPException(403, "Somente o administrador gerencia usuários.")
    if user_id == u["id"] and payload.get("active") is False:
        raise HTTPException(400, "Você não pode desativar a própria conta.")
    with db.tx() as conn:
        conn.execute(
            "UPDATE users SET name=?, role=?, active=? WHERE id=?",
            (payload.get("name"), payload.get("role"), 1 if payload.get("active", True) else 0, user_id),
        )
    return {"ok": True}


@app.post("/api/users/{user_id}/password")
def set_password(request: Request, user_id: int, payload: dict):
    u = current_user(request)
    if u["role"] != "administrador":
        raise HTTPException(403, "Somente o administrador gerencia usuários.")
    password = payload.get("password") or ""
    if len(password) < 6:
        raise HTTPException(400, "A senha deve ter pelo menos 6 caracteres.")
    with db.tx() as conn:
        conn.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(password), user_id))
    return {"ok": True}


# ── Catalog ───────────────────────────────────────────
@app.get("/api/products")
def list_products(request: Request, q: str = "", sale_kind: str = ""):
    current_user(request)
    conn = db.get_conn()
    sql = "SELECT * FROM products WHERE active=1"
    args: list = []
    if q:
        like = f"%{q}%"
        sql += " AND (sku LIKE ? OR name LIKE ? OR product_line LIKE ? OR sap_name LIKE ?)"
        args.extend([like, like, like, like])
    sql += " ORDER BY product_line, name"
    return db.rows(conn.execute(sql, args))


@app.get("/api/products/all")
def all_products(request: Request):
    u = current_user(request)
    if u["role"] != "administrador":
        raise HTTPException(403, "Acesso restrito.")
    return db.rows(db.get_conn().execute("SELECT * FROM products ORDER BY product_line, name"))


@app.post("/api/products")
def save_product(request: Request, payload: dict):
    u = current_user(request)
    if u["role"] != "administrador":
        raise HTTPException(403, "Acesso restrito.")
    with db.tx() as conn:
        if payload.get("id"):
            conn.execute(
                """UPDATE products SET sku=?, name=?, category=?, product_line=?, license_type=?,
                   contract_term=?, list_price_usd=?, active=?, updated_at=datetime('now') WHERE id=?""",
                (
                    payload["sku"], payload["name"], payload.get("category") or "Autodesk",
                    payload.get("product_line") or "", payload.get("license_type") or "",
                    payload.get("contract_term") or "", float(payload.get("list_price_usd") or 0),
                    1 if payload.get("active", True) else 0, payload["id"],
                ),
            )
            pid = payload["id"]
        else:
            cur = conn.execute(
                """INSERT INTO products (sku, name, category, product_line, license_type, contract_term, list_price_usd, active, source)
                   VALUES (?,?,?,?,?,?,?,?, 'manual')""",
                (
                    payload["sku"], payload["name"], payload.get("category") or "Autodesk",
                    payload.get("product_line") or "", payload.get("license_type") or "",
                    payload.get("contract_term") or "", float(payload.get("list_price_usd") or 0), 1,
                ),
            )
            pid = cur.lastrowid
    return {"id": pid}


@app.get("/api/catalog")
def catalog(request: Request):
    u = current_user(request)
    meta = catalog_meta()
    imports = list_imports() if u["role"] == "administrador" else []
    return {"meta": meta, "imports": imports}


@app.post("/api/products/import")
async def import_price_list(request: Request, file: UploadFile = File(...)):
    u = require_admin(request)
    raw = await file.read()
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(400, "Arquivo maior que 20 MB.")
    if not raw:
        raise HTTPException(400, "Arquivo vazio.")
    try:
        return save_upload_and_apply(file.filename or "tabela.xlsx", raw, u["id"])
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, f"Não foi possível ler a planilha: {e}")


@app.get("/api/system/update")
def system_update_info(request: Request):
    require_admin(request)
    cfg = updater._settings()
    out = {
        "repo": cfg["repo"],
        "branch": cfg["branch"],
        "has_token": bool(cfg["token"]),
        "catalog": catalog_meta(),
    }
    try:
        out.update(updater.remote_info())
        out["ok"] = True
    except Exception as e:
        out["ok"] = False
        out["error"] = str(e)
    return out


@app.post("/api/system/github")
def save_github(request: Request, payload: dict):
    require_admin(request)
    updater.save_github_settings(
        payload.get("repo") or "",
        payload.get("branch") or "main",
        payload.get("token"),
    )
    return {"ok": True}


@app.post("/api/system/update")
def system_update(request: Request):
    require_admin(request)
    try:
        return updater.apply_github_update()
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/clients")
def list_clients(request: Request):
    current_user(request)
    return db.rows(db.get_conn().execute("SELECT * FROM clients ORDER BY name"))


@app.get("/api/clients/csn/{csn}")
def find_client(request: Request, csn: str):
    current_user(request)
    row = db.one(db.get_conn().execute("SELECT * FROM clients WHERE lower(csn)=lower(?)", (csn,)))
    if not row:
        raise HTTPException(404, "Cliente não encontrado.")
    return row


@app.post("/api/clients")
def save_client(request: Request, payload: dict):
    u = current_user(request)
    try:
        with db.tx() as conn:
            if payload.get("id"):
                conn.execute(
                    """UPDATE clients SET csn=?, name=?, document=?, email=?, manager_name=?, phone=?,
                       updated_at=datetime('now') WHERE id=?""",
                    (
                        payload["csn"].strip(), payload["name"].strip(), payload["document"].strip(),
                        payload.get("email"), payload.get("manager_name"), payload.get("phone"), payload["id"],
                    ),
                )
                cid = payload["id"]
            else:
                cur = conn.execute(
                    """INSERT INTO clients (csn, name, document, email, manager_name, phone, created_by)
                       VALUES (?,?,?,?,?,?,?)""",
                    (
                        payload["csn"].strip(), payload["name"].strip(), payload["document"].strip(),
                        payload.get("email"), payload.get("manager_name"), payload.get("phone"), u["id"],
                    ),
                )
                cid = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Já existe um cliente com este CSN.")
    return {"id": cid}


@app.get("/api/suppliers")
def list_suppliers(request: Request):
    current_user(request)
    return db.rows(db.get_conn().execute("SELECT * FROM suppliers WHERE active=1"))


@app.get("/api/credits")
def credits(request: Request):
    current_user(request)
    conn = db.get_conn()
    summary = services.credit_summary(conn)
    ledger = db.rows(
        conn.execute(
            """SELECT h.*, po.client_name
               FROM hubgov_ledger h
               LEFT JOIN purchase_orders po ON po.id = h.purchase_order_id
               ORDER BY h.id DESC"""
        )
    )
    return {"summary": summary, "ledger": ledger, "available": services.available_credits(conn)}


# ── ODC ───────────────────────────────────────────────
@app.get("/api/odc/next")
def next_odc(request: Request):
    current_user(request)
    return {"number": services.preview_number(db.get_conn(), "odc")}


@app.get("/api/odc")
def list_odc(request: Request):
    u = current_user(request)
    conn = db.get_conn()
    if u["role"] == "vendedor":
        rows = db.rows(
            conn.execute(
                """SELECT po.*, s.name AS supplier_name FROM purchase_orders po
                   JOIN suppliers s ON s.id = po.supplier_id
                   WHERE po.created_by=? ORDER BY po.seq DESC""",
                (u["id"],),
            )
        )
    else:
        rows = db.rows(
            conn.execute(
                """SELECT po.*, s.name AS supplier_name FROM purchase_orders po
                   JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.seq DESC"""
            )
        )
    return rows


@app.get("/api/odc/{odc_id}")
def get_odc(request: Request, odc_id: int):
    current_user(request)
    order = services.odc_with_items(db.get_conn(), odc_id)
    if not order:
        raise HTTPException(404, "Ordem não encontrada.")
    return order


@app.post("/api/odc")
def post_odc(request: Request, payload: dict):
    u = current_user(request)
    with db.tx() as conn:
        return services.save_odc(conn, u, payload)


@app.post("/api/odc/{odc_id}/send")
def send_odc(request: Request, odc_id: int):
    u = current_user(request)
    with db.tx() as conn:
        return services.mark_sent(conn, u, odc_id)


@app.post("/api/odc/{odc_id}/cancel")
def cancel_odc(request: Request, odc_id: int):
    u = current_user(request)
    with db.tx() as conn:
        return services.cancel_odc(conn, u, odc_id)


@app.get("/api/odc/{odc_id}/word")
def word_odc(request: Request, odc_id: int):
    current_user(request)
    order = services.odc_with_items(db.get_conn(), odc_id)
    if not order:
        raise HTTPException(404, "Ordem não encontrada.")
    body = odc_html(order, order["items"], include_status=False)
    return FastResponse(
        as_word(body),
        media_type="application/msword",
        headers={"Content-Disposition": f'attachment; filename="{order["number"]}.doc"'},
    )


@app.post("/api/odc/calc")
def calc_odc(request: Request, payload: dict):
    current_user(request)
    return compute_odc(
        payload.get("items") or [],
        payload.get("dollar_rate"),
        payload.get("discount_pct"),
        payload.get("client_type"),
        payload.get("hubgov_credit_pct"),
        payload.get("credit_used"),
    )


# ── Sales ─────────────────────────────────────────────
@app.get("/api/vendas")
def list_sales(request: Request):
    u = current_user(request)
    conn = db.get_conn()
    if u["role"] == "vendedor":
        return db.rows(
            conn.execute(
                """SELECT so.*, po.number AS purchase_order_number, po.client_name
                   FROM sales_orders so JOIN purchase_orders po ON po.id = so.purchase_order_id
                   WHERE so.created_by=? ORDER BY so.seq DESC""",
                (u["id"],),
            )
        )
    return db.rows(
        conn.execute(
            """SELECT so.*, po.number AS purchase_order_number, po.client_name
               FROM sales_orders so JOIN purchase_orders po ON po.id = so.purchase_order_id
               ORDER BY so.seq DESC"""
        )
    )


@app.get("/api/vendas/{so_id}")
def get_sale(request: Request, so_id: int):
    current_user(request)
    order = services.sales_with_items(db.get_conn(), so_id)
    if not order:
        raise HTTPException(404, "Pedido não encontrado.")
    return order


@app.post("/api/vendas")
def post_sale(request: Request, payload: dict):
    u = current_user(request)
    with db.tx() as conn:
        return services.save_sales(conn, u, payload)


@app.post("/api/vendas/{so_id}/cancel")
def cancel_sale(request: Request, so_id: int):
    u = current_user(request)
    with db.tx() as conn:
        return services.cancel_sales(conn, u, so_id)


@app.get("/api/vendas/{so_id}/word")
def word_sale(request: Request, so_id: int):
    current_user(request)
    order = services.sales_with_items(db.get_conn(), so_id)
    if not order:
        raise HTTPException(404, "Pedido não encontrado.")
    body = sales_html(order, order["items"])
    return FastResponse(
        as_word(body),
        media_type="application/msword",
        headers={"Content-Disposition": f'attachment; filename="{order["number"]}.doc"'},
    )


# ── Dashboard / reports ───────────────────────────────
@app.get("/api/dashboard")
def dashboard(request: Request):
    current_user(request)
    conn = db.get_conn()
    odc_count = conn.execute("SELECT COUNT(*) AS n FROM purchase_orders WHERE status!='cancelado'").fetchone()["n"]
    pending = conn.execute("SELECT COUNT(*) AS n FROM purchase_orders WHERE status='pendente_envio'").fetchone()["n"]
    sales_total = conn.execute(
        "SELECT COALESCE(SUM(sale_total_brl),0) AS n FROM sales_orders WHERE status!='cancelado'"
    ).fetchone()["n"]
    credits = services.credit_summary(conn)
    recent = db.rows(
        conn.execute(
            """SELECT po.*, s.name AS supplier_name FROM purchase_orders po
               JOIN suppliers s ON s.id=po.supplier_id ORDER BY po.seq DESC LIMIT 8"""
        )
    )
    return {
        "odc_count": odc_count,
        "pending_pars": pending,
        "sales_total": sales_total,
        "credits": credits,
        "recent": recent,
    }


@app.get("/api/gestao")
def gestao(request: Request):
    u = current_user(request)
    if u["role"] not in ("administrador", "diretor"):
        raise HTTPException(403, "Acesso restrito à diretoria.")
    conn = db.get_conn()
    monthly = db.rows(
        conn.execute(
            """SELECT substr(order_date,1,7) AS month, COUNT(*) AS pedidos, SUM(sale_total_brl) AS total
               FROM sales_orders WHERE status!='cancelado' GROUP BY month ORDER BY month"""
        )
    )
    by_type = db.rows(
        conn.execute(
            """SELECT client_type AS type, COUNT(*) AS pedidos, SUM(sale_total_brl) AS total
               FROM sales_orders WHERE status!='cancelado' GROUP BY client_type"""
        )
    )
    by_seller = db.rows(
        conn.execute(
            """SELECT seller_name, COUNT(*) AS pedidos, AVG(margin_pct) AS margem, SUM(sale_total_brl) AS total
               FROM sales_orders WHERE status!='cancelado' GROUP BY seller_name ORDER BY total DESC"""
        )
    )
    top = db.rows(
        conn.execute(
            """SELECT product_name, SUM(qty) AS qtd, SUM(line_total_brl) AS total
               FROM sales_order_items i JOIN sales_orders s ON s.id=i.sales_order_id
               WHERE s.status!='cancelado' GROUP BY product_name ORDER BY total DESC LIMIT 10"""
        )
    )
    return {"monthly": monthly, "by_type": by_type, "by_seller": by_seller, "top_products": top}


@app.get("/api/export/csv")
def export_csv(request: Request, kind: str = "odc"):
    u = current_user(request)
    if u["role"] not in ("administrador", "diretor"):
        raise HTTPException(403, "Acesso restrito.")
    conn = db.get_conn()
    if kind == "vendas":
        rows = db.rows(
            conn.execute(
                """SELECT so.number, so.order_date, so.status, so.client_type, po.number AS odc,
                          po.client_name, so.contact_origin, so.sale_total_brl, so.margin_pct, so.seller_name
                   FROM sales_orders so JOIN purchase_orders po ON po.id=so.purchase_order_id ORDER BY so.seq"""
            )
        )
        name = "vendas.csv"
    else:
        rows = db.rows(
            conn.execute(
                """SELECT number, order_date, status, client_type, sale_kind, client_name, client_csn,
                          dollar_rate, list_total_brl, discount_pct, net_total_brl, credit_generated
                   FROM purchase_orders ORDER BY seq"""
            )
        )
        name = "odc.csv"
    if not rows:
        body = "\ufeff"
    else:
        headers = list(rows[0].keys())
        lines = [";".join(headers)]
        for r in rows:
            lines.append(";".join(str(r[h] if r[h] is not None else "") for h in headers))
        body = "\ufeff" + "\n".join(lines)
    return FastResponse(
        body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# ── Frontend ──────────────────────────────────────────
@app.get("/favicon.ico")
def favicon():
    ico = FRONTEND / "favicon.ico"
    if ico.is_file():
        return FileResponse(ico, media_type="image/x-icon", headers={"Cache-Control": "public, max-age=86400"})
    raise HTTPException(404)


@app.get("/")
def index():
    return FileResponse(FRONTEND / "index.html", headers=NO_STORE)


@app.get("/{path:path}")
def spa(path: str):
    if path.startswith("api/") or path.startswith("static/"):
        raise HTTPException(404)
    file = FRONTEND / path
    if file.is_file():
        return FileResponse(file)
    return FileResponse(FRONTEND / "index.html", headers=NO_STORE)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
