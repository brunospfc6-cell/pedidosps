# Pro-Systems no Windows Server 2019 — 192.168.0.10

Servidor de compartilhamento de arquivos da empresa. O sistema **não** é uma pasta
de rede: é um site IIS. Os usuários abrem o navegador em **http://192.168.0.10/**.

Guia completo do IIS: [PASSO-IIS-2019.md](PASSO-IIS-2019.md)

Se o atalho abre o Gerenciador do IIS ou a tela azul: rode
`corrigir-atalho.bat` **como administrador**. Detalhes em [PUBLICAR-AGORA.md](PUBLICAR-AGORA.md).

## Ordem

1. Copiar o app para `C:\Apps\Pro-Systems` (disco local).
2. Python + venv + `.env` (modelo `.env.producao.example`).
3. Serviço `ProSystemsApp` (`instalar-servico.bat` + `nssm.exe`).
4. **IIS no IP 192.168.0.10** — este é o passo que publica para os usuários.

## Usuários

| O que fazer | O que não fazer |
|---|---|
| Abrir http://192.168.0.10/ | Mapear `C:\Apps\Pro-Systems` |
| Atalho **Pro-Systems** (abre o navegador) | Atalho do Gerenciador do IIS ou `services.msc` |
| Login com o usuário criado pelo admin | Copiar `app.db` para a rede |
| `corrigir-atalho.bat` como administrador | Rodar `start.bat` em cada PC |

## Banco

```
C:\Apps\Pro-Systems\data\app.db
```

Um único processo Python (o serviço). SQLite não pode ficar em `\\servidor\share`.
