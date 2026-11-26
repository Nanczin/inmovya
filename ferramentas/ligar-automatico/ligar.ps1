# Inmovya - ligar automatico pelo Vincular ao Celular
# Recebe "inmovya-ligar:+5511999999999", abre o numero no Vincular ao Celular e aperta o botao de ligar.
param([string]$url)
$ErrorActionPreference = 'SilentlyContinue'
$pasta = Join-Path $env:LOCALAPPDATA 'Inmovya'
$log = Join-Path $pasta 'ligar.log'
function Anotar($t) { try { Add-Content -Path $log -Value ("{0:dd/MM HH:mm:ss}  {1}" -f (Get-Date), $t) -Encoding UTF8 } catch {} }

$num = ($url -replace '^inmovya-ligar:', '') -replace '%2B', '+' -replace '[^\d\+]', ''
if ($num.Length -lt 10) { Anotar "numero invalido: $url"; exit }
# trava: se o mesmo numero foi pedido ha menos de 10 segundos, nao liga de novo (evita ligacao dupla)
$trava = Join-Path $pasta 'ultima.txt'
try {
  $ult = Get-Content $trava -ErrorAction Stop
  $p = $ult -split ';'
  if ($p[0] -eq $num -and ((Get-Date) - [datetime]::Parse($p[1])).TotalSeconds -lt 10) { Anotar "ignorado (pedido repetido) $num"; exit }
} catch {}
Set-Content -Path $trava -Value ("{0};{1:o}" -f $num, (Get-Date))
Anotar "ligando $num"
Start-Process "tel:$num"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class InmovyaJanela {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
"@
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
      # o botao verde se chama "Ligar Numero discado +55..." (ou so "Ligar"/"Call")
      $ehLigar = ($nomes -contains $n) -or ($n -match '^(Ligar|Chamar|Call)\s+(N.mero|number)')
      if ($ehLigar -and $b.Current.IsEnabled) {
        try {
          # traz o Vincular ao Celular para frente, seleciona o botao verde e aperta Enter
          $h = [IntPtr]$j.Current.NativeWindowHandle
          if ($h -eq [IntPtr]::Zero) { $h = [InmovyaJanela]::FindWindow($null, $titulo) }
          if ($h -ne [IntPtr]::Zero) { if ([InmovyaJanela]::IsIconic($h)) { [InmovyaJanela]::ShowWindow($h, 9) | Out-Null }; [InmovyaJanela]::SetForegroundWindow($h) | Out-Null }
          Start-Sleep -Milliseconds 250
          $b.SetFocus()
          Start-Sleep -Milliseconds 200
          [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
          Anotar "selecionei e apertei Enter no botao '$n'"
          # deixa a chamada comecar e minimiza o Vincular ao Celular (volta para o Inmovya)
          Start-Sleep -Milliseconds 1500
          if ($h -eq [IntPtr]::Zero) { $h = [InmovyaJanela]::FindWindow($null, $titulo) }
          if ($h -eq [IntPtr]::Zero) { $h = [InmovyaJanela]::GetForegroundWindow() }
          if ($h -ne [IntPtr]::Zero) {
            $ok = [InmovyaJanela]::ShowWindow($h, 6)
            Anotar "minimizei o Vincular ao Celular (janela $h, '$titulo', resultado $ok)"
          } else { Anotar "nao achei a janela para minimizar ('$titulo')" }
          exit
        } catch { Anotar "nao consegui apertar '$n': $($_.Exception.Message)" }
      }
    }
  }
}
Anotar ("nao achei o botao de ligar. Botoes vistos: " + (($vistos.Keys | Sort-Object) -join ' | '))
