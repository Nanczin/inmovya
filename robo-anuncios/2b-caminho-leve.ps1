# Robo de anuncios - caminho leve: usa a versao 12 do banco interno (better-sqlite3), que ja vem pronta
# para Windows, sem precisar das ferramentas de compilacao. Guarda copia do original (package.json.original).
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pasta = Join-Path $base "OpenWA"
$log = Join-Path $base "log-leve.txt"
"=== Caminho leve - inicio: $(Get-Date) ===" | Out-File $log -Encoding utf8
function Registra($t) { Write-Host $t -ForegroundColor Cyan; $t | Out-File $log -Append -Encoding utf8 }

$env:Path = (Join-Path $base "node22") + ";" + [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
Registra ("node: " + (node --version 2>&1))
Set-Location $pasta

if (-not (Test-Path "package.json.original")) { Copy-Item package.json package.json.original; Copy-Item package-lock.json package-lock.json.original }
node -e "const f='package.json';const p=JSON.parse(require('fs').readFileSync(f,'utf8'));p.dependencies['better-sqlite3']='^12.2.0';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
Registra ("better-sqlite3 agora: " + (node -p "require('./package.json').dependencies['better-sqlite3']"))

Registra "=== Instalando (5 a 15 minutos, NAO feche a janela) ==="
npm install --no-audit --no-fund 2>&1 | Tee-Object -FilePath $log -Append
Registra "npm install terminou com codigo: $LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { Write-Host "Deu erro. Me avise no chat." -ForegroundColor Red; Read-Host "Enter para fechar"; exit 1 }
node -e "require('better-sqlite3')(':memory:').prepare('select 1 as ok').get()" 2>&1 | Tee-Object -FilePath $log -Append
Registra "teste do banco: $LASTEXITCODE"
"ok" | Out-File (Join-Path $pasta "node_modules\.instalado-node22")
Registra "=== Instalado. Ligando o OpenWA... ==="
& (Join-Path $base "2-baixar-e-ligar-openwa.ps1")
