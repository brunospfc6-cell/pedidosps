"""
Ajustes para o app funcionar atras do IIS com HTTPS.

No servidor, na pasta do projeto:

    .venv\\Scripts\\python.exe deploy-windows-server\\patch-producao.py

O script e idempotente: pode rodar de novo.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "app" / "config.py"
SEC = ROOT / "app" / "security.py"
MAIN = ROOT / "main.py"


def upsert_config() -> None:
    if not CFG.exists():
        raise SystemExit("app/config.py nao encontrado. Rode este script na pasta do projeto extraido.")
    text = CFG.read_text(encoding="utf-8")
    extra = '''
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").rstrip("/")
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0").strip() in ("1", "true", "True", "yes")
'''
    if "PUBLIC_URL" not in text:
        if "SESSION_HOURS" in text:
            text = text.replace(
                "SESSION_HOURS = int(os.environ.get(\"SESSION_HOURS\", \"12\"))",
                "SESSION_HOURS = int(os.environ.get(\"SESSION_HOURS\", \"12\"))\n"
                + extra,
            )
        else:
            text += extra
        CFG.write_text(text, encoding="utf-8")
        print("config.py: PUBLIC_URL e COOKIE_SECURE")
    else:
        print("config.py: ja atualizado")


def upsert_cookie() -> None:
    if not SEC.exists():
        raise SystemExit("app/security.py nao encontrado.")
    text = SEC.read_text(encoding="utf-8")
    if "COOKIE_SECURE" not in text:
        text = text.replace("from .config import SECRET_KEY, SESSION_HOURS",
                            "from .config import COOKIE_SECURE, SECRET_KEY, SESSION_HOURS")
        old = """    response.set_cookie(
        COOKIE,
        make_session(user_id),
        httponly=True,
        samesite="lax",
        max_age=SESSION_HOURS * 3600,
    )"""
        new = """    response.set_cookie(
        COOKIE,
        make_session(user_id),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=SESSION_HOURS * 3600,
        path="/",
    )"""
        if old not in text:
            # variante com path ja presente
            old = """    response.set_cookie(
        COOKIE,
        make_session(user_id),
        httponly=True,
        samesite="lax",
        max_age=SESSION_HOURS * 3600,
        path="/",
    )"""
            new = """    response.set_cookie(
        COOKIE,
        make_session(user_id),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=SESSION_HOURS * 3600,
        path="/",
    )"""
        if old not in text:
            print("security.py: bloco set_cookie nao encontrado — ajuste manualmente secure=COOKIE_SECURE")
        else:
            text = text.replace(old, new)
            SEC.write_text(text, encoding="utf-8")
            print("security.py: cookie seguro atras de HTTPS")
    else:
        print("security.py: ja atualizado")


def upsert_proxy() -> None:
    if not MAIN.exists():
        raise SystemExit("main.py nao encontrado.")
    text = MAIN.read_text(encoding="utf-8")
    if "ProxyHeadersMiddleware" in text:
        print("main.py: ja atualizado")
        return
    if "from fastapi import FastAPI" in text:
        text = text.replace(
            "from fastapi import FastAPI",
            "from fastapi import FastAPI\nfrom uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware",
            1,
        )
    needle = "app = FastAPI"
    idx = text.find(needle)
    if idx < 0:
        print("main.py: app = FastAPI nao encontrado — adicione ProxyHeadersMiddleware na mao")
        return
    # inserir depois da linha app = FastAPI(...)
    nl = text.find("\n", idx)
    insert = "\napp.add_middleware(ProxyHeadersMiddleware, trusted_hosts=\"*\")\n"
    text = text[: nl + 1] + insert + text[nl + 1 :]
    MAIN.write_text(text, encoding="utf-8")
    print("main.py: ProxyHeadersMiddleware (HTTPS pelo IIS)")


if __name__ == "__main__":
    upsert_config()
    upsert_cookie()
    upsert_proxy()
    print("Pronto. Reinicie o servico ProSystemsApp.")
