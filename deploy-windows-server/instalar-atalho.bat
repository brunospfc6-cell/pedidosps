@echo off
title Atalho Pro-Systems na area de trabalho
cd /d "%~dp0"

echo.
echo Cria o atalho Pro-Systems (abre o navegador).
echo Nao abre o Gerenciador do IIS.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-iis.ps1" -AtalhoSomente
echo.
echo Se ainda abrir o Gerenciador do IIS (globo com engrenagem):
echo   - Apague esse atalho antigo
echo   - Clique com o direito em corrigir-atalho.bat
echo     e escolha Executar como administrador
echo.
pause
