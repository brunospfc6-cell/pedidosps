@echo off
cd /d "%~dp0"
title Empacotar Pro-Systems (ZIP local)
set ZIP=Pro-Systems-Compras-Vendas.zip
if exist "%ZIP%" del "%ZIP%"
echo Gerando %ZIP% com o codigo do app local (sem .venv e sem banco)...
tar.exe -a -c -f "%ZIP%" main.py schema.sql requirements.txt start.bat pack-windows.bat .env.example README.md .gitignore app frontend seed deploy-windows-server
if errorlevel 1 (
  echo Nao foi possivel criar o ZIP. Compacte manualmente as pastas listadas no README.
  pause
  exit /b 1
)
echo.
echo Pacote criado: %ZIP%
echo Nao inclui .venv nem data\app.db
echo No servidor 192.168.0.10: extraia em C:\Apps\Pro-Systems e siga deploy-windows-server\PASSO-IIS-2019.md
pause
