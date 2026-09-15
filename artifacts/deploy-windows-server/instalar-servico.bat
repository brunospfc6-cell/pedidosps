@echo off
cd /d "%~dp0"
title Instalar servico Pro-Systems

if not exist "nssm.exe" (
  echo Baixe o NSSM 64-bit em https://nssm.cc/download
  echo Extraia nssm.exe para esta pasta:
  echo   %cd%
  pause
  exit /b 1
)

set APPDIR=%~dp0..
for %%I in ("%APPDIR%") do set APPDIR=%%~fI
set PYTHON=%APPDIR%\.venv\Scripts\python.exe

if not exist "%PYTHON%" (
  echo Ambiente virtual nao encontrado:
  echo   %PYTHON%
  echo Rode na pasta do projeto: python -m venv .venv ^& .venv\Scripts\activate ^& pip install -r requirements.txt
  pause
  exit /b 1
)

if not exist "%APPDIR%\logs" mkdir "%APPDIR%\logs"

nssm stop ProSystemsApp >nul 2>nul
nssm remove ProSystemsApp confirm >nul 2>nul

nssm install ProSystemsApp "%PYTHON%"
nssm set ProSystemsApp AppParameters "-m uvicorn main:app --host 127.0.0.1 --port 8000"
nssm set ProSystemsApp AppDirectory "%APPDIR%"
nssm set ProSystemsApp DisplayName "Pro-Systems Compras e Vendas"
nssm set ProSystemsApp Start SERVICE_AUTO_START
nssm set ProSystemsApp AppStdout "%APPDIR%\logs\servico.log"
nssm set ProSystemsApp AppStderr "%APPDIR%\logs\servico.err.log"
nssm set ProSystemsApp AppRotateFiles 1
nssm set ProSystemsApp AppRotateBytes 2000000
nssm set ProSystemsApp AppExit Default Restart
nssm set ProSystemsApp AppRestartDelay 4000

nssm start ProSystemsApp
echo.
echo Servico ProSystemsApp instalado e iniciado.
echo Teste no servidor: http://127.0.0.1:8000
echo.
pause
