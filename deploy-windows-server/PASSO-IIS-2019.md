# Publicar agora (app já instalado)

Se o Python já está no servidor, use só este guia curto:

**[PUBLICAR-AGORA.md](PUBLICAR-AGORA.md)** — `corrigir-atalho.bat` como Administrador, depois **http://192.168.0.10/**.

Se o atalho abre o Gerenciador do IIS ou a tela azul “IIS Windows Server”, esse é o arquivo certo.

---

# Passo IIS — Windows Server 2019 (192.168.0.10)

Servidor de arquivos da Pro-Systems. Os usuários **não** abrem a pasta compartilhada.
Eles abrem o navegador em:

**http://192.168.0.10/**

```
PCs da rede  →  http://192.168.0.10/  →  IIS (porta 80)
                                              ↓
                                   Python em 127.0.0.1:8000 (só no servidor)
                                              ↓
                                   C:\Apps\Pro-Systems\data\app.db
```

Não instale o app dentro de `\\192.168.0.10\...` nem em disco mapeado.
A pasta do sistema fica no disco local do servidor: `C:\Apps\Pro-Systems`.

---

## Antes (já deve estar pronto)

1. Pasta `C:\Apps\Pro-Systems` copiada (com `main.py`, `app`, `frontend`, `seed`).
2. Python 3.10+ instalado (**Add python.exe to PATH**).
3. Ambiente criado:

```bat
cd /d C:\Apps\Pro-Systems
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy deploy-windows-server\.env.producao.example .env
```

O `.env` deste servidor já vem assim:

```
HOST=127.0.0.1
PORT=8000
PUBLIC_URL=http://192.168.0.10
COOKIE_SECURE=0
```

4. Serviço Windows `ProSystemsApp` rodando (`deploy-windows-server\instalar-servico.bat`).
5. No **próprio servidor**, o login abre em http://127.0.0.1:8000

Se o passo 5 falhar, não siga o IIS. O Python precisa estar no ar primeiro.

---

## 1. Instalar o IIS

No servidor, **PowerShell como Administrador**:

```powershell
Install-WindowsFeature Web-Server, Web-WebServer, Web-Common-Http, Web-Default-Doc, Web-Static-Content, Web-Http-Errors, Web-Http-Redirect, Web-Health, Web-Http-Logging, Web-Performance, Web-Stat-Compression, Web-Filtering, Web-Mgmt-Console
```

Ou: Gerenciador do Servidor → Adicionar funções → **Servidor Web (IIS)** + Console de Gerenciamento.

## 2. URL Rewrite + ARR (obrigatório)

Baixe e instale, nesta ordem, os dois MSI **64-bit**:

1. [URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite)
2. [Application Request Routing 3.0](https://www.iis.net/downloads/microsoft/application-request-routing)

Depois, IIS Manager:

1. Clique no **nome do servidor** (raiz, não no site)
2. **Application Request Routing Cache**
3. à direita: **Server Proxy Settings**
4. Marque **Enable proxy**
5. Apply

Sem isso o site devolve 500.

## 3. Criar o site (clique a clique)

1. IIS Manager → **Sites** → clique com o direito em **Default Web Site** → **Stop**
2. Em **Bindings** do Default Web Site, **remova** o http porta 80 (senão a tela azul volta no reboot)
3. Sites → **Add Website…**
4. Preencha:

| Campo | Valor |
|---|---|
| Site name | `Pro-Systems` |
| Physical path | `C:\Apps\Pro-Systems\frontend` |
| Binding type | `http` |
| IP address | **All Unassigned** |
| Port | `80` |
| Host name | **deixe vazio** |

Host name vazio é o que faz `http://192.168.0.10/` funcionar na rede.

5. OK.
6. Copie `C:\Apps\Pro-Systems\deploy-windows-server\web.config` para `C:\Apps\Pro-Systems\frontend\web.config` (já vai no pacote; confira se o arquivo está lá).

## 4. Variáveis do reverse proxy

IIS Manager → servidor → **URL Rewrite** → **View Server Variables** → Add:

- `HTTP_X_FORWARDED_PROTO`
- `HTTP_X_FORWARDED_HOST`

## 5. Firewall do Windows

PowerShell como Administrador:

```powershell
New-NetFirewallRule -DisplayName "Pro-Systems IIS HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Domain,Private
```

Não abra a porta 8000. Ela é só interna (IIS → Python).

## 6. Atalho para os usuários

**Não** crie atalho para o Gerenciador do IIS (`InetMgr.exe`) nem para Serviços (`services.msc`).

O atalho certo abre o **navegador** em `http://192.168.0.10/`.

Arquivos prontos em `deploy-windows-server\`:

| Arquivo | Uso |
|---|---|
| `corrigir-atalho.bat` | Como administrador: conserta o IIS e instala o atalho |
| `Abrir-Pro-Systems.bat` | Duplo clique = Chrome/Edge na tela Entrar |
| `Atalho-Pro-Systems.url` | Mesmo endereço, para copiar na pasta pública |
| `Abrir-Pro-Systems.html` | Abre no navegador e redireciona |

Exemplo na pasta já compartilhada:

`\\192.168.0.10\Publico\Pro-Systems.url`

**Não compartilhe** a pasta `C:\Apps\Pro-Systems`.

## 7. Conferir

| De onde | Endereço | O que deve aparecer |
|---|---|---|
| No servidor | http://127.0.0.1:8000 | Tela Entrar |
| No servidor | http://192.168.0.10/ | A mesma tela, pelo IIS |
| PC de um vendedor | http://192.168.0.10/ | A mesma tela |

Login inicial: `olivia.t@example.org` / `Admin@123` — troque a senha depois.

Se a tela abre e o login não grava: o serviço Python caiu, ou o `.env` está com `COOKIE_SECURE=1`. Neste servidor interno deixe `0`.

Se aparecer a página azul **IIS Windows Server**, o Default Web Site ainda está na porta 80. Rode `corrigir-atalho.bat` como administrador.

## 8. Script único (recomendado)

Como Administrador:

```
C:\Apps\Pro-Systems\deploy-windows-server\corrigir-atalho.bat
```

Ou no PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
cd C:\Apps\Pro-Systems\deploy-windows-server
.\configurar-iis.ps1
```

O script instala o papel IIS, tira a porta 80 do Default Web Site, cria o site **Pro-Systems** em `*:80`, abre o firewall e coloca o atalho na área de trabalho. URL Rewrite e ARR ainda precisam dos MSI (passo 2).

## 9. Nome amigável (opcional)

Em vez do IP, no DNS interno (AD) crie:

| Tipo | Nome | Valor |
|---|---|---|
| A | `compras` | `192.168.0.10` |

Fica `http://compras` ou `http://compras.seudominio.local`. Se fizer isso, altere no `.env`:

```
PUBLIC_URL=http://compras
```

e reinicie o serviço:

```bat
nssm restart ProSystemsApp
```

O site IIS pode continuar com host name vazio (atende IP e nome).

## 10. Backup do banco

O banco **não** vai na pasta compartilhada. Agende no servidor:

```
C:\Apps\Pro-Systems\data\
```

para `C:\Backup\Pro-Systems\` (ou o backup que o file server já usa).
