@echo off
cd /d "%~dp0\.."
title Pro-Systems (servidor 192.168.0.10)

if not exist ".venv\Scripts\python.exe" (
  echo Crie o ambiente primeiro: python -m venv .venv
  echo Depois: .venv\Scripts\activate ^& pip install -r requirements.txt
  pause
  exit /b 1
)

if not exist ".env" (
  if exist "deploy-windows-server\.env.producao.example" (
    copy "deploy-windows-server\.env.producao.example" ".env" >nul
    echo Arquivo .env criado para http://192.168.0.10
  )
)

if not exist "data" mkdir data
if not exist "logs" mkdir logs

echo.
echo Python interno: http://127.0.0.1:8000
echo Usuarios na rede: http://192.168.0.10  (pelo IIS)
echo.

".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --log-level info
