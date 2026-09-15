"""Ajustes HTTPS/IIS — o codigo do app ja inclui cookie e proxy.

Mantido para reaplicar se alguem voltar um ZIP antigo.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
print("App em", ROOT)
print("config.py, security.py e main.py ja estao prontos para o IIS em http://192.168.0.10")
print("Use COOKIE_SECURE=0 no .env deste servidor (HTTP interno).")
print("Reinicie: nssm restart ProSystemsApp")
