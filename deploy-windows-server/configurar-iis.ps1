# Publica o Pro-Systems no IIS (Windows Server 2019)
# e instala o atalho que abre o navegador — nao o Gerenciador do IIS.
#
# PowerShell como Administrador, nesta pasta:
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\configurar-iis.ps1
# So o atalho (sem IIS):
#   .\configurar-iis.ps1 -AtalhoSomente

param(
    [switch]$AtalhoSomente
)

$ErrorActionPreference = "Stop"
$IpPreferido = "192.168.0.10"
$Port = 80
$SiteName = "Pro-Systems"
$PublicUrl = "http://192.168.0.10/"
$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Phys = Join-Path $AppDir "frontend"
$WebConfigSrc = Join-Path $PSScriptRoot "web.config"

function Install-ProSystemsShortcut {
    $urlSrc = Join-Path $PSScriptRoot "Atalho-Pro-Systems.url"
    $htmlSrc = Join-Path $PSScriptRoot "Abrir-Pro-Systems.html"
    $batSrc = Join-Path $PSScriptRoot "Abrir-Pro-Systems.bat"
    $destinations = New-Object System.Collections.Generic.List[string]
    foreach ($folder in @(
        [Environment]::GetFolderPath("CommonDesktopDirectory"),
        [Environment]::GetFolderPath("Desktop"),
        "C:\Users\Public\Desktop",
        "C:\Publico",
        "C:\Shares\Publico"
    )) {
        if ($folder -and (Test-Path $folder) -and -not $destinations.Contains($folder)) {
            $destinations.Add($folder)
        }
    }
    $Wsh = New-Object -ComObject WScript.Shell
    foreach ($d in $destinations) {
        if (Test-Path $urlSrc) {
            Copy-Item $urlSrc (Join-Path $d "Pro-Systems.url") -Force
        }
        if (Test-Path $htmlSrc) {
            Copy-Item $htmlSrc (Join-Path $d "Pro-Systems.html") -Force
        }
        if (Test-Path $batSrc) {
            Copy-Item $batSrc (Join-Path $d "Abrir-Pro-Systems.bat") -Force
        }
        $lnkPath = Join-Path $d "Pro-Systems.lnk"
        $lnk = $Wsh.CreateShortcut($lnkPath)
        $lnk.TargetPath = "$env:SystemRoot\System32\rundll32.exe"
        $lnk.Arguments = "url.dll,FileProtocolHandler $PublicUrl"
        $lnk.WindowStyle = 7
        $lnk.WorkingDirectory = $AppDir
        $lnk.Description = "Pro-Systems Compras e Vendas"
        $lnk.IconLocation = "$env:SystemRoot\System32\url.dll,0"
        $lnk.Save()
        Write-Host "Atalho criado: $lnkPath"
    }
}

if ($AtalhoSomente) {
    Write-Host "Instalando so o atalho Pro-Systems (navegador em $PublicUrl)"
    Install-ProSystemsShortcut
    Write-Host ""
    Write-Host "Use o icone Pro-Systems. Nao use o Gerenciador do IIS."
    try { Start-Process $PublicUrl } catch { }
    return
}

Write-Host "Pasta do aplicativo: $AppDir"
if (-not (Test-Path (Join-Path $AppDir "main.py"))) {
    throw "main.py nao encontrado em $AppDir"
}
if (-not (Test-Path $Phys)) {
    throw "Pasta frontend nao encontrada: $Phys"
}

Write-Host "Verificando o Python em http://127.0.0.1:8000 ..."
$pythonOk = $false
try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "Python no ar. ($($h.StatusCode))"
    $pythonOk = $true
} catch {
    Write-Host "ATENCAO: o aplicativo Python nao respondeu na porta 8000."
    Write-Host "Inicie o servico ProSystemsApp (services.msc) e rode este script de novo."
}

Write-Host "Instalando papel IIS (se ainda nao estiver)..."
Install-WindowsFeature Web-Server, Web-WebServer, Web-Common-Http, Web-Default-Doc, `
  Web-Static-Content, Web-Http-Errors, Web-Http-Redirect, Web-Health, Web-Http-Logging, `
  Web-Performance, Web-Stat-Compression, Web-Filtering, Web-Mgmt-Console | Out-Null

Import-Module WebAdministration

if (Test-Path $WebConfigSrc) {
    Copy-Item $WebConfigSrc (Join-Path $Phys "web.config") -Force
    Write-Host "web.config copiado para $Phys"
}

# Libera a porta 80: o site padrao do IIS (tela azul) nao pode ficar nela.
Get-Website | ForEach-Object {
    $site = $_
    if ($site.Name -eq $SiteName) { return }
    $http80 = @(Get-WebBinding -Name $site.Name -ErrorAction SilentlyContinue |
        Where-Object { $_.protocol -eq "http" -and $_.bindingInformation -match ':80:' })
    foreach ($b in $http80) {
        Write-Host "Removendo $($b.bindingInformation) de '$($site.Name)' (libera a porta $Port)."
        Remove-WebBinding -Name $site.Name -BindingInformation $b.bindingInformation -Protocol http -ErrorAction SilentlyContinue
    }
}

$default = Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue
if ($default) {
    if ($default.State -eq "Started") {
        Stop-Website "Default Web Site"
    }
    Set-ItemProperty "IIS:\Sites\Default Web Site" -Name serverAutoStart -Value $false
    Write-Host "Default Web Site parado e sem inicio automatico."
}

$existing = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-Website -Name $SiteName -ErrorAction SilentlyContinue
    Remove-Website -Name $SiteName
}

# *:80 atende 192.168.0.10, localhost e o nome do servidor.
New-Website -Name $SiteName -PhysicalPath $Phys -IPAddress "*" -Port $Port -Force | Out-Null
Set-ItemProperty "IIS:\Sites\$SiteName" -Name serverAutoStart -Value $true
Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $Phys

try {
    Clear-WebConfiguration -Filter "system.webServer/defaultDocument/files" -PSPath "IIS:\Sites\$SiteName"
    Add-WebConfigurationProperty -Filter "system.webServer/defaultDocument/files" `
      -PSPath "IIS:\Sites\$SiteName" -Name "." -Value @{ value = "index.html" }
} catch {
    Write-Host "Documento padrao: $($_.Exception.Message)"
}

Start-Website -Name $SiteName
Write-Host "Site $SiteName publicado em *:80  (caminho $Phys)"

try {
    New-NetFirewallRule -DisplayName "Pro-Systems IIS HTTP" -Direction Inbound `
      -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain,Private -ErrorAction Stop | Out-Null
    Write-Host "Firewall: porta $Port liberada (Domain/Private)."
} catch {
    Write-Host "Firewall: $($_.Exception.Message)"
}

$rewriteOk = Get-WebGlobalModule | Where-Object { $_.Name -match "Rewrite" }
$arrOk = Get-WebGlobalModule | Where-Object { $_.Name -match "RequestRouting|ApplicationRequestRouting" }
if ($rewriteOk -and $arrOk) {
    try {
        Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "enabled" -Value "True"
        foreach ($v in @("HTTP_X_FORWARDED_PROTO", "HTTP_X_FORWARDED_HOST")) {
            $have = Get-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" `
              -Filter "system.webServer/rewrite/allowedServerVariables/add[@name='$v']" -Name "." -ErrorAction SilentlyContinue
            if (-not $have) {
                Add-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" `
                  -Filter "system.webServer/rewrite/allowedServerVariables" -Name "." -Value @{name=$v}
            }
        }
        Write-Host "ARR proxy habilitado."
    } catch {
        Write-Host "ARR: $($_.Exception.Message)"
    }
} else {
    Write-Host ""
    Write-Host "FALTA instalar estes dois MSI 64-bit (nesta ordem), depois rode o script de novo:"
    Write-Host "  1) URL Rewrite  https://www.iis.net/downloads/microsoft/url-rewrite"
    Write-Host "  2) ARR 3.0      https://www.iis.net/downloads/microsoft/application-request-routing"
    Write-Host "No IIS, clique no NOME DO SERVIDOR > Application Request Routing Cache > Server Proxy Settings > Enable proxy"
}

Install-ProSystemsShortcut

Write-Host ""
Write-Host "Conferindo $PublicUrl ..."
$paginaIis = $false
try {
    $page = Invoke-WebRequest -Uri $PublicUrl -UseBasicParsing -TimeoutSec 8
    $html = [string]$page.Content
    if ($html -match "IIS Windows Server" -or $html -match "iisstart") {
        $paginaIis = $true
        Write-Host "AINDA a pagina azul do IIS. Default Web Site nao soltou a porta 80."
    } elseif ($html -match "Pro-Systems" -or $html -match "Entrar") {
        Write-Host "OK: o navegador deve mostrar a tela Entrar do Pro-Systems."
    } else {
        Write-Host "Resposta HTTP $($page.StatusCode). Abra $PublicUrl e confira."
    }
} catch {
    $resp = $_.Exception.Response
    if ($resp -and [int]$resp.StatusCode -ge 500) {
        Write-Host "IIS respondeu erro $($resp.StatusCode). ARR/Python provavelmente fora."
    } else {
        Write-Host "Nao consegui testar $PublicUrl : $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "================================================"
Write-Host "Usuarios na rede abrem:"
Write-Host "  $PublicUrl"
Write-Host "Atalho na area de trabalho: Pro-Systems"
Write-Host "Nao compartilhe a pasta do aplicativo."
Write-Host "Nao use o Gerenciador do IIS como atalho."
if (-not $pythonOk) {
    Write-Host "Python ainda parado — inicie ProSystemsApp e teste de novo."
}
if ($paginaIis) {
    Write-Host "Ainda a tela do IIS: em Sites, Stop no Default Web Site e Start no Pro-Systems."
}
Write-Host "================================================"
