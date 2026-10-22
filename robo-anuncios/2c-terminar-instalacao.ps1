# Robo de anuncios - 2c: termina a instalacao que foi interrompida (caminho leve).
# Nao apaga nada. Usa o Google Chrome do PC (nao baixa outro navegador = economiza disco).
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pasta = Join-Path $base "OpenWA"
$log = Join-Path $base "log-2c.txt"
"=== 2c - inicio: $(Get-Date) ===" | Out-File $log -Encoding utf8
function Registra($t) { Write-Host $t -ForegroundColor Cyan; Add-Content -Path $log -Value $t -Encoding UTF8 }

$env:Path = (Join-Path $base "node22") + ";" + [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
$env:PUPPETEER_SKIP_DOWNLOAD = "true"
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
Registra ("node: " + (node --version 2>&1) + " | chrome: " + $chrome)
$livre = [math]::Round((Get-PSDrive C).Free/1GB,1); Registra "Disco C livre: $livre GB"
Set-Location $pasta
Registra ("better-sqlite3 no package.json: " + (node -p "require('./package.json').dependencies['better-sqlite3']"))

Registra "=== Terminando a instalacao (5 a 15 minutos). NAO feche esta janela, mesmo se parecer parada. ==="
npm install --no-audit --no-fund 2>&1 | ForEach-Object { $l = "$_"; Write-Host $l; Add-Content -Path $log -Value $l -Encoding UTF8 }
$cod = $LASTEXITCODE
Registra "npm install terminou com codigo: $cod"
if ($cod -ne 0) { Write-Host "Deu erro. Me avise no chat (ficou gravado em log-2c.txt)." -ForegroundColor Red; Read-Host "Enter para fechar"; exit 1 }
node -e "require('better-sqlite3')(':memory:').prepare('select 1 as ok').get(); console.log('banco OK')" 2>&1 | ForEach-Object { Registra "$_" }
Registra ("dashboard instalado: " + (Test-Path (Join-Path $pasta "dashboard\node_modules")))
"ok" | Out-File (Join-Path $pasta "node_modules\.instalado-node22")
$livre = [math]::Round((Get-PSDrive C).Free/1GB,1); Registra "Disco C livre no fim: $livre GB"
Registra "=== Instalado. Ligando o OpenWA... ==="
& (Join-Path $base "2-baixar-e-ligar-openwa.ps1")
