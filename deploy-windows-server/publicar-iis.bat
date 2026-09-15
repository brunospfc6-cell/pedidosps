@echo off
title Publicar Pro-Systems no IIS
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo Clique com o direito neste arquivo e escolha:
  echo   Executar como administrador
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-iis.ps1"
echo.
echo Atalho certo: Pro-Systems na area de trabalho
echo   abre http://192.168.0.10/  (tela Entrar)
echo Atalho errado: Gerenciador do IIS  (globo com engrenagem)
echo.
pause
