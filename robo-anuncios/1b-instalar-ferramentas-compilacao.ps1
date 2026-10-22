# Robo de anuncios - Passo 1b: ferramentas que o OpenWA precisa para montar o banco de dados interno
# (Visual Studio Build Tools com C++ e Python). Gratuitas, da Microsoft. Nao apaga nada.
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $base "log-ferramentas.txt"
"=== Inicio: $(Get-Date) ===" | Out-File $log -Encoding utf8
function Registra($t) { Write-Host $t -ForegroundColor Cyan; $t | Out-File $log -Append -Encoding utf8 }

Registra "=== Instalando Visual Studio Build Tools (C++) - download grande (~2 GB), pode levar 20-40 minutos ==="
Registra "O Windows vai pedir permissao: clique em SIM."
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --accept-package-agreements --accept-source-agreements --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" 2>&1 | Tee-Object -FilePath $log -Append
Registra "Build Tools terminou com codigo: $LASTEXITCODE"

if (-not (Get-Command python -ErrorAction SilentlyContinue) -or ((python --version 2>&1) -notmatch "Python 3")) {
  Registra "=== Instalando Python 3.12 ==="
  winget install --id Python.Python.3.12 -e --source winget --accept-package-agreements --accept-source-agreements 2>&1 | Tee-Object -FilePath $log -Append
  Registra "Python terminou com codigo: $LASTEXITCODE"
} else { Registra ("Python ja instalado: " + (python --version 2>&1)) }

Registra "=== FIM das ferramentas ==="
Write-Host "Pronto. Agora rode de novo o 2-baixar-e-ligar-openwa." -ForegroundColor Green
Read-Host "Aperte Enter para fechar"
