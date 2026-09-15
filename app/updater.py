from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import GITHUB_BRANCH, GITHUB_REPO, GITHUB_TOKEN, ROOT
from . import db
from .pricelist import set_meta

PRESERVE_NAMES = {
    "data",
    ".env",
    ".venv",
    "venv",
    "logs",
    "node_modules",
    ".git",
    "__pycache__",
    "screenshots",
    ".tanstack",
    ".vercel",
}
PRESERVE_FILES = {"frontend/web.config"}


def _settings() -> dict:
    conn = db.get_conn()
    rows = {}
    try:
        rows = {r["key"]: r["value"] for r in db.rows(conn.execute("SELECT key, value FROM catalog_meta"))}
    except Exception:
        pass
    repo = (rows.get("github_repo") or GITHUB_REPO or "").strip()
    branch = (rows.get("github_branch") or GITHUB_BRANCH or "main").strip() or "main"
    token = (rows.get("github_token") or GITHUB_TOKEN or "").strip()
    return {"repo": repo, "branch": branch, "token": token}


def save_github_settings(repo: str, branch: str, token: str | None):
    with db.tx() as conn:
        set_meta(conn, github_repo=(repo or "").strip(), github_branch=(branch or "main").strip() or "main")
        if token:
            set_meta(conn, github_token=token.strip())



def _headers(token: str) -> dict:
    h = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Pro-Systems-Compras-Vendas",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _get(url: str, token: str, binary: bool = False):
    req = Request(url, headers=_headers(token))
    try:
        with urlopen(req, timeout=60) as resp:
            data = resp.read()
            if binary:
                return data
            return json.loads(data.decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        if e.code == 404:
            raise RuntimeError(
                "Repositório não encontrado. Confira o nome (usuario/repositorio) e, se for privado, informe o token."
            ) from e
        if e.code in (401, 403):
            raise RuntimeError("GitHub recusou o acesso. Verifique o token ou o limite de requisições.") from e
        raise RuntimeError(f"GitHub retornou {e.code}: {body[:180]}") from e
    except URLError as e:
        raise RuntimeError(f"Sem conexão com o GitHub: {e.reason}") from e


def remote_info() -> dict:
    cfg = _settings()
    if not cfg["repo"] or "/" not in cfg["repo"]:
        return {
            "configured": False,
            "repo": cfg["repo"],
            "branch": cfg["branch"],
            "has_token": bool(cfg["token"]),
            "message": "Informe o repositório no formato usuario/projeto.",
        }
    repo = cfg["repo"]
    branch = cfg["branch"]
    token = cfg["token"]
    commit = _get(f"https://api.github.com/repos/{repo}/commits/{branch}", token)
    sha = commit.get("sha", "")[:10]
    msg = ((commit.get("commit") or {}).get("message") or "").split("\n", 1)[0]
    date = ((commit.get("commit") or {}).get("author") or {}).get("date") or ""
    local = ""
    try:
        local = db.get_conn().execute(
            "SELECT value FROM catalog_meta WHERE key='app_git_sha'"
        ).fetchone()
        local = local["value"] if local else ""
    except Exception:
        local = ""
    return {
        "configured": True,
        "repo": repo,
        "branch": branch,
        "has_token": bool(token),
        "sha": sha,
        "message": msg,
        "date": date,
        "local_sha": local,
        "up_to_date": bool(local) and local == sha,
    }


def _project_root_from_zip(extracted: Path) -> Path:
    entries = [p for p in extracted.iterdir() if p.name not in (".", "..")]
    if len(entries) == 1 and entries[0].is_dir():
        inner = entries[0]
        if (inner / "main.py").exists() or (inner / "app").exists():
            return inner
    return extracted


def apply_github_update() -> dict:
    info = remote_info()
    if not info.get("configured"):
        raise RuntimeError(info.get("message") or "Repositório GitHub não configurado.")
    cfg = _settings()
    url = f"https://api.github.com/repos/{cfg['repo']}/zipball/{cfg['branch']}"
    blob = _get(url, cfg["token"], binary=True)
    tmp = Path(tempfile.mkdtemp(prefix="ps-upd-"))
    zip_path = tmp / "src.zip"
    zip_path.write_bytes(blob)
    extract_to = tmp / "src"
    extract_to.mkdir()
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_to)
    src = _project_root_from_zip(extract_to)
    if not (src / "main.py").exists() or not (src / "app").exists():
        shutil.rmtree(tmp, ignore_errors=True)
        raise RuntimeError(
            "O ZIP do GitHub não contém o aplicativo Python (main.py / app/). Publique este sistema no repositório antes de atualizar."
        )

    copied: list[str] = []
    for item in src.iterdir():
        if item.name in PRESERVE_NAMES or item.name.startswith(".env"):
            continue
        dest = ROOT / item.name
        if item.is_dir():
            if dest.exists() and item.name == "frontend" and (dest / "web.config").exists():
                web = (dest / "web.config").read_bytes()
            else:
                web = None
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(item, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            if web is not None:
                (dest / "web.config").write_bytes(web)
        else:
            shutil.copy2(item, dest)
        copied.append(item.name)

    req = ROOT / "requirements.txt"
    pip = ROOT / ".venv" / "Scripts" / "pip.exe"
    if not pip.exists():
        pip = ROOT / ".venv" / "bin" / "pip"
    pip_ok = False
    if req.exists() and pip.exists():
        try:
            subprocess.run(
                [str(pip), "install", "-q", "-r", str(req)],
                check=False,
                timeout=120,
                capture_output=True,
            )
            pip_ok = True
        except Exception:
            pip_ok = False

    with db.tx() as conn:
        set_meta(
            conn,
            app_git_sha=info["sha"],
            app_updated_at=datetime.now().isoformat(timespec="seconds"),
            app_git_message=info.get("message") or "",
        )

    shutil.rmtree(tmp, ignore_errors=True)
    restart = _try_restart()
    return {
        "ok": True,
        "sha": info["sha"],
        "message": info.get("message"),
        "copied": copied,
        "pip": pip_ok,
        "restart": restart,
    }


def _try_restart() -> str:
    if os.name == "nt":
        nssm = shutil.which("nssm")
        if nssm:
            try:
                subprocess.Popen([nssm, "restart", "ProSystemsApp"], close_fds=True)
                return "serviço"
            except Exception:
                pass
        return "recarregue"
    # Sandbox / Linux: touch to help --reload; caller may already be live
    try:
        main = ROOT / "main.py"
        main.touch()
    except Exception:
        pass
    return "recarregue"
