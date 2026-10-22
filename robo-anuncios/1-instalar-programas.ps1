# Robo de anuncios - Passo 1: confere e instala Git e Node.js (so o que faltar)
# Nao apaga nada. Pode rodar de novo quantas vezes quiser.
$ErrorActionPreference = "Continue"
Write-Host ""
Write-Host "=== Conferindo o que ja esta instalado ===" -ForegroundColor Cyan

function Versao($cmd, $arg) {
  try { return (& $cmd $arg 2>$null | Select-Object -First 1) } catch { return $null }
}

$git = Versao "git" "--version"
$node = Versao "node" "--version"
Write-Host ("Git:     " + ($(if ($git) { $git } else { "NAO instalado" })))
Write-Host ("Node.js: " + ($(if ($node) { $node } else { "NAO instalado" })))

$precisaNode = $true
if ($node -match "^v(\d+)\.(\d+)") {
  $maior = [int]$Matches[1]; $menor = [int]$Matches[2]
  if ($maior -gt 22 -or ($maior -eq 22 -and $menor -ge 19)) { $precisaNode = $false }
  else { Write-Host "Node.js antigo (precisa 22.19 ou mais novo) - vou atualizar." -ForegroundColor Yellow }
}

if (-not $git -or $precisaNode) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "O instalador do Windows (winget) nao foi encontrado." -ForegroundColor Red
    Write-Host "Me avise no chat que eu te passo os links de download."
    Read-Host "Aperte Enter para fechar"
    exit 1
  }
  if (-not $git) {
    Write-Host ""
    Write-Host "=== Instalando o Git (o Windows pode pedir permissao: clique em Sim) ===" -ForegroundColor Cyan
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  }
  if ($precisaNode) {
    Write-Host ""
    Write-Host "=== Instalando o Node.js LTS (o Windows pode pedir permissao: clique em Sim) ===" -ForegroundColor Cyan
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
  }
}

Write-Host ""
Write-Host "=== Pronto ===" -ForegroundColor Green
Write-Host "Feche esta janela e me avise no chat. Se algo foi instalado agora, o proximo passo abre numa janela nova."
Read-Host "Aperte Enter para fechar"
