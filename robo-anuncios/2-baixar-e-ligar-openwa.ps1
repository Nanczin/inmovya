# Robo de anuncios - Passo 2: baixa o OpenWA (1a vez), instala e liga.
# Nao apaga nada. Grava tudo em log-instalacao.txt (para o Claude conferir).
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pasta = Join-Path $base "OpenWA"
$log = Join-Path $base "log-instalacao.txt"
"=== Inicio: $(Get-Date) ===" | Out-File $log -Encoding utf8

function Registra($txt) { Write-Host $txt -ForegroundColor Cyan; $txt | Out-File $log -Append -Encoding utf8 }

$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

# O OpenWA usa o Node.js 22. Baixa um Node 22 so para esta pasta (nao mexe no Node do PC).
$node22 = Join-Path $base "node22"
if (-not (Test-Path (Join-Path $node22 "node.exe"))) {
  Registra "=== Baixando o Node.js 22 (so para o robo) ==="
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $ProgressPreference = "SilentlyContinue"
  $lista = Invoke-RestMethod "https://nodejs.org/dist/index.json"
  $v = ($lista | Where-Object { $_.version -like "v22.*" } | Select-Object -First 1).version
  $zip = Join-Path $env:TEMP "node-$v-win-x64.zip"
  Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-win-x64.zip" -OutFile $zip
  Expand-Archive $zip -DestinationPath $base -Force
  Rename-Item (Join-Path $base "node-$v-win-x64") "node22"
  Registra "Node $v baixado."
}
$env:Path = "$node22;" + $env:Path
Registra ("git: " + (git --version 2>&1)); Registra ("node: " + (node --version 2>&1)); Registra ("npm: " + (npm --version 2>&1))

if (-not (Test-Path (Join-Path $pasta "package.json"))) {
  Registra "=== Baixando o OpenWA ==="
  git clone https://github.com/rmyndharis/OpenWA.git "$pasta" 2>&1 | Tee-Object -FilePath $log -Append
}
Set-Location $pasta

if (-not (Test-Path (Join-Path $pasta "node_modules\.instalado-node22"))) {
  Registra "=== Instalando (demora de 5 a 15 minutos, NAO feche a janela) ==="
  npm install --no-audit --no-fund 2>&1 | Tee-Object -FilePath $log -Append
  Registra "npm ci terminou com codigo: $LASTEXITCODE"
  if ($LASTEXITCODE -eq 0) { "ok" | Out-File (Join-Path $pasta "node_modules\.instalado-node22") }
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

# Usa o Google Chrome do PC para o WhatsApp Web (nao precisa baixar outro navegador)
$env:PUPPETEER_SKIP_DOWNLOAD = "true"
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) { $env:PUPPETEER_EXECUTABLE_PATH = $chrome; Registra "Chrome: $chrome" }

Registra "=== Ligando o OpenWA ==="
Write-Host "Painel:  http://localhost:2886"
Write-Host "API:     http://localhost:2785/api"
Write-Host "NAO feche esta janela enquanto quiser o robo funcionando."
$logow = Join-Path $base "log-openwa.txt"; "" | Out-File $logow -Encoding utf8
npm run dev 2>&1 | ForEach-Object { $l = "$_"; Write-Host $l; Add-Content -Path $logow -Value $l -Encoding UTF8 }
Registra "OpenWA parou: $(Get-Date)"
Read-Host "Aperte Enter para fechar"
