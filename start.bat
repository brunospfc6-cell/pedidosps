@echo off
cd /d "%~dp0"
title Pro-Systems Compras e Vendas
chcp 65001 >nul

set PY=
where python >nul 2>nul && set PY=python
if "%PY%"=="" (
  where py >nul 2>nul && set PY=py
)
if "%PY%"=="" (
  echo Instale o Python 3.10+ em https://www.python.org/downloads/
  echo Marque a opcao "Add python.exe to PATH".
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Criando ambiente virtual...
  %PY% -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if not exist ".env" (
  copy .env.example .env >nul
)

if not exist "data" mkdir data

echo.
echo Abrindo http://127.0.0.1:8000
echo Login inicial: olivia.t@example.org  /  Admin@123
echo Banco de dados: data\app.db
echo.

start "" "http://127.0.0.1:8000"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
