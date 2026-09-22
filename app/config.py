from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent.parent

def _load_env():
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

_load_env()

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
SECRET_KEY = os.environ.get("SECRET_KEY", "pro-systems-local-altere-esta-chave")
_db = Path(os.environ.get("DATABASE_PATH", "data/app.db"))
DATABASE_PATH = _db if _db.is_absolute() else (ROOT / _db)
SESSION_HOURS = int(os.environ.get("SESSION_HOURS", "12"))
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").rstrip("/")
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0").strip() in ("1", "true", "True", "yes")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "brunospfc6-cell/pedidosps")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

COMPANY = {
    "name": "Pro-Systems Informática LTDA",
    "shortName": "Pro-Systems",
    "addressLine1": "SRTV/Sul Quadra 701, Palácio do Rádio I, N° 130 SL 209",
    "addressLine2": "CEP 70340-901 — Brasília/DF",
    "cnpj": "03.620.200/0001-35",
    "ie": "07.310.608/001-13",
    "phone": "61-3202.2666",
    "tagline": "Revenda Autorizada Autodesk",
}

SIGNATURE = {
    "role": "Diretor",
    "company": "Pro-Systems Informática Ltda.",
    "cnpjLine": "CNPJ 03.620.200/0001-35",
}

PARS = {
    "name": "PARS PRODUTOS DE PROCESSAMENTO DE DADOS LTDA",
    "cnpj": "27.626.290/0001-30",
    "city": "Rio de Janeiro",
    "state": "RJ",
}

MIN_NET_BRL = 20.0
DEFAULT_HUBGOV_PCT = 8.0
OPENING_HUBGOV_BRL = 194372.95


SALE_KIND_LABEL = {
    "nova": "Novas Licenças",
    "renovacao": "Renovação de Licenças",
}
STATUS_LABEL = {
    "rascunho": "Rascunho",
    "pendente_envio": "Pendente Envio à PARS",
    "enviado_pars": "Enviado à PARS",
    "cancelado": "Cancelado",
    "aberto": "Aberto",
}
CONTACT_ORIGINS = [
    "Fale Conosco (site)",
    "Contato(e-mail)",
    "Lig. Cliente",
    "Evento Físico",
    "Indic. Clientes",
    "Indic. Parceiros",
    "LC",
    "Mailing RD MKT",
    "Linkedln",
    "Google Ads",
    "Instagram",
    "Facebook",
    "TLMKT",
    "Visitas",
    "Webinar",
    "Grupo WhastsAPP",
]

ROLE_LABEL = {
    "administrador": "Administrador",
    "vendedor": "Vendedor",
    "diretor": "Diretor",
}
