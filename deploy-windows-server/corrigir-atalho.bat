@echo off
title Corrigir atalho e IIS — Pro-Systems
cd /d "%~dp0"

echo.
echo Este passo faz duas coisas:
echo   1. Cria o atalho "Pro-Systems" na area de trabalho
echo      (abre o navegador em http://192.168.0.10/ )
echo   2. Tira a porta 80 do site padrao do IIS
echo      para parar a tela azul "IIS Windows Server"
echo.
echo Nao use o atalho "Gerenciador dos Servicos de Informacoes
echo da Internet (IIS)" nem o "Servicos" (services.msc).
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo Clique com o direito neste arquivo e escolha:
  echo   Executar como administrador
  echo.
  echo Sem isso o IIS continua mostrando a tela padrao.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-iis.ps1"
echo.
pause
