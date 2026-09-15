# Pro-Systems — Compras e Vendas (aplicativo local para Windows)

Sistema de **ordens de compra (ODC)** e **pedidos de venda** da Pro-Systems Informatica LTDA, revenda autorizada Autodesk.

Roda **no seu PC**, sem nuvem, sem Docker e sem internet no uso do dia a dia. Os dados ficam em um arquivo SQLite na pasta `data/`.

Não depende de Firebase, Supabase, PlanetScale nem de login Google/Microsoft.

## O que o app faz

| Tela | Quem usa | Função |
|---|---|---|
| Entrar | todos | Login local (e-mail + senha definidos pelo administrador) |
| Painel | todos | Totais de ODC, pendências PARS, vendas e saldo HubGov |
| Ordens de Compra | vendedor / admin / diretor | Criar ODC (Governo ou Privado), finalizar, confirmar envio à PARS, cancelar, extrair Word |
| Pedidos de Venda | vendedor / admin / diretor | Gerar PV a partir da ODC, margem, contrato/proposta, cancelar, Word |
| Clientes | todos | Cadastro por CSN (criar e editar) |
| HubGov | todos | Créditos gerados e utilizados |
| Produtos e Preços | administrador | Tabela Autodesk Setembro 2026 (838 SKUs) |
| Usuários | administrador | Cria usuários e **escolhe a senha** |
| Gestão e Análise | diretor / administrador | Totais, extração CSV |

### Regras de negócio

- Primeiro passo da ODC: **Governo** ou **Privado**. Somente Governo gera crédito HubGov (≥ 8% sobre o valor de lista).
- Numeração sequencial: `ODC-000001`, `PV-000001`.
- Fornecedor padrão: **PARS PRODUTOS DE PROCESSAMENTO DE DADOS LTDA**, CNPJ 27.626.290/0001-30, Rio de Janeiro/RJ.
- SKUs Autodesk em USD, câmbio do dia, desconto, datas de licença, prazo de pagamento.
- Bloco de faturamento da Pro-Systems na ODC (não entra no Word de venda).
- Após **Finalizar**, aparece **Confirmar Envio à PARS**. Confirmado, a ODC trava.
- Cancelar ODC: status `Cancelado`, estorna HubGov e cancela as vendas ligadas. Pedidos não são apagados.
- Venda Governo = contrato administrativo. Venda Privado = proposta + data do aceite.
- Assinatura impressa (sem caneta digital): Diretor / Pro-Systems Informática Ltda. / CNPJ n° 03.620.200/0001-35.
- Extração em **Word** (Arial 11 pt, logo no cabeçalho). Sem PDF.
- Status “Pendente Envio à PARS” **não** aparece no Word.
- Valor líquido mínimo de R$ 20,00 quando há crédito HubGov utilizado.

## Requisitos

- Windows 10 ou 11
- [Python 3.10+](https://www.python.org/downloads/) (recomendado 3.12). Marque **Add python.exe to PATH**.
- Internet só na **primeira** instalação (`pip install`). Depois o uso é local.

## Como subir (duplo clique)

1. Extraia a pasta do app para um lugar fixo, por exemplo `C:\Pro-Systems`
2. Dê **duplo clique** em `start.bat`
3. O navegador abre em [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Como subir (comandos)

No Prompt de Comando, dentro da pasta do projeto:

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Abra [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Login de teste (criado na primeira execução)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | olivia.t@example.org | Admin@123 |
| Vendedor | ivan.p@example.net | Vendedor@123 |
| Diretor | rachel.c@example.org | Diretor@123 |

Altere essas senhas em **Usuários** depois do primeiro acesso.

Também já entram:

- Fornecedor **PARS** (CNPJ 27.626.290/0001-30)
- Planilha Autodesk **Setembro 2026** (838 SKUs)
- Dois clientes de exemplo (Governo e Privado)
- Uma ODC de exemplo (`ODC-000001`) pronta para confirmar o envio à PARS

## Onde fica o banco

```
data\app.db
```

Caminho completo típico: `C:\Pro-Systems\data\app.db` (ou a pasta em que você extraiu o ZIP).

### Backup

1. Feche o aplicativo (janela preta do `start.bat`)
2. Copie a pasta **`data/`** inteira para pendrive, OneDrive local ou outro disco
3. Para restaurar: cole de volta no mesmo lugar, substituindo `app.db`

Não é necessário copiar `.venv`.

## Exportar / levar o código

### ZIP (mais simples)

1. Dê duplo clique em `pack-windows.bat`, **ou** compacte manualmente só estes itens:

```
main.py
schema.sql
requirements.txt
start.bat
pack-windows.bat
.env.example
README.md
.gitignore
app\
frontend\
seed\
deploy-windows-server\
```

2. **Não** inclua `.venv`, `data\app.db`, `node_modules`, `src` (resto antigo).
3. No outro PC: extraia, rode `start.bat`.

### GitHub

```bat
git init
git add main.py schema.sql requirements.txt start.bat pack-windows.bat .env.example README.md .gitignore app frontend seed
git commit -m "Pro-Systems local"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pro-systems-local.git
git push -u origin main
```

No outro computador: `git clone` e depois os mesmos passos de instalação.

## Estrutura

```
main.py              servidor FastAPI
schema.sql           tabelas SQLite (criadas na 1ª execução)
app/                 regras de negócio, autenticação, Word
frontend/            telas HTML/CSS/JS
seed/price-list.json tabela Autodesk
data/app.db          banco (criado na 1ª execução)
start.bat            duplo clique no Windows
.env.example         modelo de configuração
```

## Configuração (`.env`)

Copie `.env.example` para `.env`. Você pode mudar a porta e o caminho do banco:

```
HOST=127.0.0.1
PORT=8000
DATABASE_PATH=data/app.db
SECRET_KEY=altere-esta-chave-secreta-pro-systems
```

O `start.bat` sobe em `127.0.0.1:8000` mesmo se você alterar a porta no `.env`. Para mudar a porta do duplo clique, edite o `start.bat`.

Não use banco remoto. Este app é local de propósito.

## Publicar no Windows Server 2019 (192.168.0.10)

O file server da empresa publica o sistema **pelo IIS**, não pela pasta compartilhada.

Os usuários abrem: **http://192.168.0.10/**

Instalação no servidor:

1. Extraia em `C:\Apps\Pro-Systems` (disco local — nunca `\\192.168.0.10\...`)
2. Python + `venv` + `pip install -r requirements.txt`
3. `copy deploy-windows-server\.env.producao.example .env`
4. Serviço Windows: `deploy-windows-server\instalar-servico.bat` (precisa do [NSSM](https://nssm.cc/download))
5. **IIS:** siga [deploy-windows-server/PASSO-IIS-2019.md](deploy-windows-server/PASSO-IIS-2019.md)

Atalho para os usuários: `deploy-windows-server\Abrir-Pro-Systems.bat` (abre o navegador, **não** o Gerenciador do IIS).

Se o atalho atual abre a tela do IIS: no servidor, clique com o direito em `deploy-windows-server\corrigir-atalho.bat` → **Executar como administrador**.

## Comando exato no Windows

```bat
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

(depois do `venv` ativado e do `pip install`)
