@echo off
cd /d "%~dp0\.."
title Pro-Systems (producao)

if not exist ".venv\Scripts\python.exe" (
  echo Crie o ambiente primeiro: python -m venv .venv
  echo Depois: .venv\Scripts\activate ^& pip install -r requirements.txt
  pause
  exit /b 1
)

if not exist ".env" (
  if exist "deploy-windows-server\.env.producao.example" (
    copy "deploy-windows-server\.env.producao.example" ".env" >nul
    echo Arquivo .env criado. Edite SECRET_KEY e PUBLIC_URL antes de publicar.
  )
)

if not exist "data" mkdir data
if not exist "logs" mkdir logs

echo.
echo Servico interno: http://127.0.0.1:8000
echo O dominio deve apontar para o IIS, nao para esta porta.
echo.

".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --log-level info
