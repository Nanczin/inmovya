# Inmovya - ligar automatico pelo Vincular ao Celular
# Recebe "inmovya-ligar:+5511999999999", abre o numero no Vincular ao Celular e aperta o botao de ligar.
param([string]$url)
$ErrorActionPreference = 'SilentlyContinue'
$pasta = Join-Path $env:LOCALAPPDATA 'Inmovya'
$log = Join-Path $pasta 'ligar.log'
function Anotar($t) { try { Add-Content -Path $log -Value ("{0:dd/MM HH:mm:ss}  {1}" -f (Get-Date), $t) -Encoding UTF8 } catch {} }

$num = ($url -replace '^inmovya-ligar:', '') -replace '%2B', '+' -replace '[^\d\+]', ''
if ($num.Length -lt 10) { Anotar "numero invalido: $url"; exit }
Anotar "ligando $num"
Start-Process "tel:$num"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$botaoCond = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
# nomes do botao de ligar (portugues e ingles)
$nomes = @('Ligar', 'Chamar', 'Fazer chamada', 'Iniciar chamada', 'Ligar para', 'Call', 'Make call', 'Start call')

$fim = (Get-Date).AddSeconds(15)
$vistos = @{}
while ((Get-Date) -lt $fim) {
  Start-Sleep -Milliseconds 400
  $janelas = $AE::RootElement.FindAll($TS::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($j in $janelas) {
    $titulo = $j.Current.Name
    if ($titulo -notlike '*Vincular ao Celular*' -and $titulo -notlike '*Phone Link*' -and $titulo -notlike '*Vincular ao Telefone*') { continue }
    $botoes = $j.FindAll($TS::Descendants, $botaoCond)
    foreach ($b in $botoes) {
      $n = ($b.Current.Name).Trim()
      if ($n) { $vistos[$n] = 1 }
      if ($nomes -contains $n -and $b.Current.IsEnabled) {
        try {
          $p = $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
          $p.Invoke()
          Anotar "apertei o botao '$n'"
          exit
        } catch { Anotar "nao consegui apertar '$n'" }
      }
    }
  }
}
Anotar ("nao achei o botao de ligar. Botoes vistos: " + (($vistos.Keys | Sort-Object) -join ' | '))
