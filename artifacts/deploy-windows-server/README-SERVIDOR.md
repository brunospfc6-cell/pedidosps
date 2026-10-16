# Publicar o Pro-Systems no Windows Server com domínio

O app continua local (Python + SQLite). Os usuários acessam pelo navegador no domínio
da empresa. O Python **não** fica exposto na internet: o IIS recebe `https://seu.dominio`
e encaminha internamente para `http://127.0.0.1:8000`.

```
Usuário  →  DNS  →  Windows Server (IIS :443)
                         ↓
                  uvicorn 127.0.0.1:8000
                         ↓
                    data\app.db
```

## O que você precisa

- Windows Server com **IIS** (comum em servidor compartilhado / Plesk)
- Python 3.10+ instalado no servidor (**Add python.exe to PATH**)
- A pasta do app copiada para um disco **local** (nunca pen-drive, OneDrive ou `\\servidor\share`)
- Um domínio (ex.: `compras.pro-systems.com.br`)
- Porta 80 e 443 liberadas no firewall do servidor
- Permissão para criar um *site* no IIS (ou pedir ao provedor)

Se o provedor só libera FTP/pasta web sem Python, este app **não** sobe como site PHP.
Peça RDP ou um pool onde você possa rodar um processo Windows.

---

## 1. Copiar o app para o servidor

1. Extraia o projeto em um caminho fixo, por exemplo:

   `C:\Apps\Pro-Systems`

2. Confira se existem: `main.py`, `app\`, `frontend\`, `seed\`, `schema.sql`,
   `requirements.txt`, `start.bat`.

3. Abra o **Prompt de Comando como Administrador**:

```bat
cd /d C:\Apps\Pro-Systems
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy deploy-windows-server\.env.producao.example .env
notepad .env
```

4. No `.env`, altere pelo menos:

```
SECRET_KEY=uma-frase-longa-aleatoria-so-deste-servidor
PUBLIC_URL=https://compras.pro-systems.com.br
COOKIE_SECURE=1
HOST=127.0.0.1
PORT=8000
DATABASE_PATH=data/app.db
```

5. Suba uma vez para criar o banco e testar:

```bat
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

No próprio servidor abra http://127.0.0.1:8000 — deve aparecer o login.
`Ctrl+C` para parar. Depois instale como serviço (passo 4).

---

## 2. Apontar o domínio (DNS)

No painel onde o domínio foi registrado (Registro.br, Cloudflare, provedor):

| Tipo | Nome / host              | Valor                         | TTL  |
|------|--------------------------|-------------------------------|------|
| A    | `compras` (ou `@`)       | IP público do Windows Server  | 300  |

Exemplos:

- `compras.pro-systems.com.br` → registro **A** no host `compras` com o IP do servidor
- Se o site principal já aponta para este servidor, um **CNAME** `compras` → `pro-systems.com.br` também serve

Espere a propagação (minutos a algumas horas). Teste no servidor:

```bat
nslookup compras.pro-systems.com.br
```

Deve devolver o IP do Windows Server.

**Quem controla o IP?** No servidor compartilhado o IP costuma ser fixo do painel
(Plesk → Assinatura → IP). Use esse IP, não o IP interno `192.168.x.x`.

---

## 3. IIS + certificado HTTPS

### 3.1 Módulos do IIS

No servidor (ou peça ao provedor):

- IIS com o site em branco no domínio
- Extensão **URL Rewrite**
- **Application Request Routing (ARR)** com *proxy* habilitado  
  IIS → servidor → Application Request Routing Cache → Server Proxy Settings →
  marcar **Enable proxy**

### 3.2 Site no IIS

1. IIS Manager → Sites → Add Website
2. Site name: `Pro-Systems`
3. Physical path: `C:\Apps\Pro-Systems\frontend` (só para o IIS ter uma pasta; o tráfego vai para o Python)
4. Binding:
   - http, porta 80, host name `compras.pro-systems.com.br`
   - https, porta 443, host name `compras.pro-systems.com.br`, certificado
5. Copie o arquivo `web.config` desta pasta para `C:\Apps\Pro-Systems\frontend\web.config`

### 3.3 Certificado

Opções, da mais simples à mais controlada:

1. **Plesk / painel do provedor** → SSL/TLS → Let’s Encrypt no domínio
2. **win-acme** (https://www.win-acme.com) no próprio servidor
3. Certificado comercial colado no IIS

Sem HTTPS o login até funciona na rede interna, mas na internet use sempre `https://`.

### 3.4 Firewall

Libere **80** e **443** de entrada. **Não** libere a porta 8000 para a internet.

---

## 4. Manter o app ligado (serviço Windows)

O `start.bat` é para uso no PC. No servidor use o NSSM:

1. Baixe https://nssm.cc/download e extraia `nssm.exe` (64-bit) para `C:\Apps\Pro-Systems\deploy-windows-server\`
2. Como Administrador:

```bat
cd /d C:\Apps\Pro-Systems\deploy-windows-server
instalar-servico.bat
```

Isso cria o serviço `ProSystemsApp`, inicia no boot e grava log em `C:\Apps\Pro-Systems\logs\`.

Comandos úteis:

```bat
nssm status ProSystemsApp
nssm restart ProSystemsApp
nssm stop ProSystemsApp
```

---

## 5. Conferir se está no ar

1. No servidor: http://127.0.0.1:8000 → login
2. De outro PC: https://compras.pro-systems.com.br → o mesmo login
3. Entre com o administrador e **troque as senhas de teste**

Se a tela abre mas o login “não pega”:

- `COOKIE_SECURE=1` com site ainda em HTTP → coloque `0` até o certificado funcionar
- `PUBLIC_URL` diferente do endereço digitado no navegador
- Relógio do servidor errado (a sessão usa data/hora)

---

## 6. Backup

O banco é um arquivo:

```
C:\Apps\Pro-Systems\data\app.db
```

Agende no Agendador de Tarefas (todo dia, app pode estar ligado — o SQLite está em WAL):

```bat
xcopy /Y /I C:\Apps\Pro-Systems\data C:\Backup\Pro-Systems\%DATE:~6,4%-%DATE:~3,2%-%DATE:~0,2%
```

Melhor ainda: copie `data\` para outro disco ou para o backup já usado pelo servidor.

---

## 7. Vários usuários ao mesmo tempo

Pode. O SQLite com WAL aguenta o time comercial (dezenas de pessoas).
Não coloque o `app.db` em pasta de rede (`\\fileserver\...`).

Um único processo uvicorn (como no `instalar-servico.bat`) é o modo certo.
Não suba dois serviços apontando para o mesmo `app.db`.

---

## 8. O que pedir ao provedor do servidor compartilhado

Envie este texto:

> Preciso hospedar um sistema Python (FastAPI) no Windows Server.
> 1. Pasta local `C:\Apps\Pro-Systems` com permissão de leitura/escrita para o serviço.
> 2. Site IIS no host `compras.MEUDOMINIO` com HTTPS.
> 3. URL Rewrite + ARR (reverse proxy) de `/` para `http://127.0.0.1:8000`.
> 4. Serviço Windows iniciando `C:\Apps\Pro-Systems\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000`.
> 5. Portas 80 e 443 no firewall. Porta 8000 só localhost.

---

## 9. Não use isto

- Publicar a porta 8000 direto na internet
- Firebase / Supabase / banco na nuvem
- Docker (não é necessário)
- Colocar `.venv` ou `data\app.db` no GitHub
