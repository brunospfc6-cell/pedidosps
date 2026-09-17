from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import DATABASE_PATH, ROOT

SCHEMA_PATH = ROOT / "schema.sql"


def connect() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


_CONN: sqlite3.Connection | None = None


def get_conn() -> sqlite3.Connection:
    global _CONN
    if _CONN is None:
        _CONN = connect()
    return _CONN


@contextmanager
def tx():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    def add_col(table, name, decl):
        cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
        if name not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
    add_col("sales_orders", "contact_origin", "TEXT")
    add_col("sales_orders", "payment_terms", "TEXT")
    add_col("sales_orders", "prorata", "INTEGER NOT NULL DEFAULT 0")
    add_col("purchase_orders", "payment_terms", "TEXT")
    add_col("purchase_orders", "prorata", "INTEGER NOT NULL DEFAULT 0")
    add_col("hubgov_ledger", "notes", "TEXT")
    add_col("hubgov_ledger", "enabled", "INTEGER NOT NULL DEFAULT 1")
    add_col("purchase_orders", "generated_nf", "TEXT")
    conn.commit()


def rows(cur) -> list[dict]:
    return [dict(r) for r in cur.fetchall()]


def one(cur) -> dict | None:
    r = cur.fetchone()
    return dict(r) if r else None
