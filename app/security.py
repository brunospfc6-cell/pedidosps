from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Optional

from fastapi import HTTPException, Request, Response

from .config import SECRET_KEY, SESSION_HOURS
from . import db

COOKIE = "ps_session"
PBKDF_ROUNDS = 120_000


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF_ROUNDS)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hash_password(password, salt)
    return hmac.compare_digest(check, stored)


def _sign(payload: str) -> str:
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def make_session(user_id: int) -> str:
    exp = int(time.time()) + SESSION_HOURS * 3600
    return _sign(f"{user_id}:{exp}")


def read_session(token: str) -> Optional[int]:
    try:
        payload, sig = token.rsplit(".", 1)
        expected = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return None
        uid, exp = payload.split(":")
        if int(exp) < time.time():
            return None
        return int(uid)
    except Exception:
        return None


def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Faça login para continuar.")
    uid = read_session(token)
    if not uid:
        raise HTTPException(401, "Sessão expirada. Entre novamente.")
    row = db.one(db.get_conn().execute("SELECT * FROM users WHERE id = ?", (uid,)))
    if not row or not row["active"]:
        raise HTTPException(401, "Usuário inativo.")
    return row


def require_roles(*roles: str):
    def _inner(user: dict) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "Sem permissão para esta ação.")
        return user
    return _inner


def set_session_cookie(response: Response, user_id: int):
    response.set_cookie(
        COOKIE,
        make_session(user_id),
        httponly=True,
        samesite="lax",
        max_age=SESSION_HOURS * 3600,
        path="/",
    )


def clear_session(response: Response):
    response.delete_cookie(COOKIE, path="/")
