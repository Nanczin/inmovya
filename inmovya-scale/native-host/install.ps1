param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -eq 'Core') {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -ExtensionId $ExtensionId
  exit $LASTEXITCODE
}
$hostDir = Join-Path $env:LOCALAPPDATA 'InmovyaScale\NativeHost'
New-Item -ItemType Directory -Force -Path $hostDir | Out-Null

$sourcePath = Join-Path $PSScriptRoot 'InmovyaFileHost.cs'
$exePath = Join-Path $hostDir 'InmovyaFileHost.exe'
Add-Type -Path $sourcePath -ReferencedAssemblies 'System.Windows.Forms','System.Web.Extensions' -OutputAssembly $exePath -OutputType ConsoleApplication

$manifestPath = Join-Path $hostDir 'com.inmovya.scale.files.json'
$manifest = @{
  name = 'com.inmovya.scale.files'
  description = 'Acesso autorizado aos arquivos originais da Inmovya Scale'
  path = $exePath
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 4
Set-Content -LiteralPath $manifestPath -Value $manifest -Encoding UTF8

$registryPaths = @(
  'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.inmovya.scale.files',
  'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.inmovya.scale.files'
)
foreach ($registryPath in $registryPaths) {
  New-Item -Path $registryPath -Force | Out-Null
  Set-Item -Path $registryPath -Value $manifestPath
}

Write-Host 'Aplicativo auxiliar Inmovya Scale instalado com sucesso.' -ForegroundColor Green
Write-Host 'Recarregue a extensão e reabra o WhatsApp Web.'
