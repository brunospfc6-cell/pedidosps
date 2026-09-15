# Publicar agora no IIS — usuários na rede

O aplicativo **já está instalado** no Windows Server 2019.
Este passo abre o acesso pelo navegador em **http://192.168.0.10/**.

Os usuários **não** entram na pasta compartilhada do sistema.

---

## Se o atalho abre a tela do IIS

Há dois atalhos diferentes. Só o segundo é o sistema:

| Atalho errado | Atalho certo |
|---|---|
| **Gerenciador dos Serviços de Informações da Internet (IIS)** — globo com engrenagem, abre o console de sites | **Pro-Systems** — abre o Chrome/Edge na tela **Entrar** |
| Página azul **IIS Windows Server** no navegador | Tela de login do Pro-Systems |
| `services.msc` (Serviços do Windows) | `http://192.168.0.10/` |

**No servidor, clique com o direito em** `deploy-windows-server\corrigir-atalho.bat` → **Executar como administrador**.

Isso:

1. para o **Default Web Site** (a tela azul) e tira a porta 80 dele
2. publica o site **Pro-Systems** em `*:80`
3. coloca o atalho **Pro-Systems** na área de trabalho
4. o atalho aponta para **http://192.168.0.10/** — nunca para o Gerenciador do IIS

Apague o atalho antigo (globo com engrenagem). Use só o **Pro-Systems**.

Na pasta compartilhada da equipe, copie `Abrir-Pro-Systems.bat` (ou `Atalho-Pro-Systems.url`). Duplo clique abre o navegador.

---

## 0. Python precisa estar ligado

No servidor: `services.msc` → serviço **Pro-Systems Compras e Vendas** (`ProSystemsApp`) → Iniciar (tipo Automático).

No próprio servidor, o login tem que abrir em http://127.0.0.1:8000. Se não abrir, não publique o IIS ainda.

## 1. Dois instaladores da Microsoft (uma vez)

Instale os MSI **64-bit**, nesta ordem:

1. [URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite)
2. [Application Request Routing 3.0](https://www.iis.net/downloads/microsoft/application-request-routing)

IIS Manager → clique no **nome do servidor** (não no site) → **Application Request Routing Cache** → à direita **Server Proxy Settings** → marque **Enable proxy** → Apply.

## 2. Publicar o site

Clique com o direito em `deploy-windows-server\corrigir-atalho.bat` (ou `publicar-iis.bat`) → **Executar como administrador**.

O script:

- instala o papel IIS se faltar
- para o Default Web Site e **remove a porta 80** dele (não volta no reboot)
- cria o site **Pro-Systems** em `*:80` (atende `http://192.168.0.10/`)
- copia o `web.config`
- libera a porta 80 no firewall da rede interna
- cria o atalho **Pro-Systems** na área de trabalho

## 3. Conferir

| Onde | Abrir | O que deve aparecer |
|---|---|---|
| Servidor | http://127.0.0.1:8000 | Tela Entrar |
| Servidor e PCs da empresa | **http://192.168.0.10/** | A mesma tela, pelo IIS |

Login: o administrador que você cadastrou (na primeira instalação: `olivia.t@example.org` / `Admin@123`).

## 4. Atalho para a equipe

Na área de trabalho do servidor já fica **Pro-Systems**.

Para a pasta que vocês já compartilham, copie um destes arquivos (todos abrem o navegador):

- `deploy-windows-server\Abrir-Pro-Systems.bat`
- `deploy-windows-server\Atalho-Pro-Systems.url`
- `deploy-windows-server\Abrir-Pro-Systems.html`

Exemplo: `\\192.168.0.10\Publico\Pro-Systems.url`

**Não** crie atalho para `InetMgr.exe`, para “Serviços de Informações da Internet” nem para `services.msc`.

## Se a tela não abrir

| Sintoma | Causa típica |
|---|---|
| Console do IIS / globo com engrenagem | Atalho errado — apague e use **Pro-Systems** |
| Página azul “IIS Windows Server” | Default Web Site ainda na porta 80 — rode `corrigir-atalho.bat` como administrador |
| 404 / site IIS padrão | Default Web Site ainda no ar |
| 500.52 / 502 | ARR sem **Enable proxy**, ou Python parado |
| Tela abre, login não grava | `.env` com `COOKIE_SECURE=1` — deixe `0` e reinicie o serviço |
| PC da rede não entra | Firewall (porta 80 Domain/Private) ou IP errado |
| Porta 80 ocupada | Outro site IIS no `*:80` — o script agora remove esses bindings |

Não abra a porta **8000** na rede. Só a **80**, pelo IIS.
