# Robo de anuncios - Passo 2: baixa o OpenWA (1a vez), instala e liga.
# Nao apaga nada. Grava tudo em log-instalacao.txt (para o Claude conferir).
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pasta = Join-Path $base "OpenWA"
$log = Join-Path $base "log-instalacao.txt"
"=== Inicio: $(Get-Date) ===" | Out-File $log -Encoding utf8

function Registra($txt) { Write-Host $txt -ForegroundColor Cyan; $txt | Out-File $log -Append -Encoding utf8 }

$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
Registra ("git: " + (git --version 2>&1)); Registra ("node: " + (node --version 2>&1)); Registra ("npm: " + (npm --version 2>&1))

if (-not (Test-Path (Join-Path $pasta "package.json"))) {
  Registra "=== Baixando o OpenWA ==="
  git clone https://github.com/rmyndharis/OpenWA.git "$pasta" 2>&1 | Tee-Object -FilePath $log -Append
}
Set-Location $pasta

if (-not (Test-Path (Join-Path $pasta "node_modules\.package-lock.json"))) {
  Registra "=== Instalando (demora de 5 a 15 minutos, NAO feche a janela) ==="
  npm ci --no-audit --no-fund 2>&1 | Tee-Object -FilePath $log -Append
  Registra "npm ci terminou com codigo: $LASTEXITCODE"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Deu erro na instalacao. Me avise no chat (o erro ficou gravado no log)." -ForegroundColor Red
    Read-Host "Aperte Enter para fechar"; exit 1
  }
}

# Configuracao do robo: motor whatsapp-web.js, ritmo de envio protegido e "digitando..."
$env:ENGINE_TYPE = "whatsapp-web.js"
$env:SEND_PACING_ENABLED = "true"
$env:SIMULATE_TYPING = "true"
$env:AUTO_START_SESSIONS = "true"
$env:SSRF_ALLOWED_HOSTS = "localhost,127.0.0.1"
$env:RESOLVE_LID_TO_PHONE = "true"

Registra "=== Ligando o OpenWA ==="
Write-Host "Painel:  http://localhost:2886"
Write-Host "API:     http://localhost:2785/api"
Write-Host "NAO feche esta janela enquanto quiser o robo funcionando."
npm run dev 2>&1 | Tee-Object -FilePath (Join-Path $base "log-openwa.txt")
Registra "OpenWA parou: $(Get-Date)"
Read-Host "Aperte Enter para fechar"
