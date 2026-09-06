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

$ffmpegPath = Join-Path $hostDir 'ffmpeg.exe'
if (-not (Test-Path -LiteralPath $ffmpegPath)) {
  Write-Host 'Instalando conversor gratuito de vídeos...'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $downloadDir = Join-Path ([IO.Path]::GetTempPath()) ("inmovya-ffmpeg-" + [Guid]::NewGuid().ToString('N'))
  $archivePath = Join-Path $downloadDir 'ffmpeg.zip'
  $extractPath = Join-Path $downloadDir 'extract'
  New-Item -ItemType Directory -Force -Path $downloadDir, $extractPath | Out-Null
  try {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $archivePath
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force
    $ffmpegSource = Get-ChildItem -LiteralPath $extractPath -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
    $ffprobeSource = Get-ChildItem -LiteralPath $extractPath -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1
    if (-not $ffmpegSource) { throw 'O pacote baixado não contém ffmpeg.exe.' }
    Copy-Item -LiteralPath $ffmpegSource.FullName -Destination $ffmpegPath -Force
    if ($ffprobeSource) { Copy-Item -LiteralPath $ffprobeSource.FullName -Destination (Join-Path $hostDir 'ffprobe.exe') -Force }
    Set-Content -LiteralPath (Join-Path $hostDir 'FFMPEG_SOURCE.txt') -Encoding UTF8 -Value @(
      'FFmpeg - https://ffmpeg.org/'
      'Windows build - https://www.gyan.dev/ffmpeg/builds/'
      'Instalado para conversão local de vídeos pela Inmovya Scale.'
    )
  }
  finally {
    if (Test-Path -LiteralPath $downloadDir) { Remove-Item -LiteralPath $downloadDir -Recurse -Force }
  }
}

$sourcePath = Join-Path $PSScriptRoot 'InmovyaFileHost.cs'
$exePath = Join-Path $hostDir 'InmovyaFileHost.exe'
Add-Type -Path $sourcePath -ReferencedAssemblies 'System.Windows.Forms','System.Web.Extensions','UIAutomationClient','UIAutomationTypes' -OutputAssembly $exePath -OutputType ConsoleApplication

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
Write-Host 'Vídeos serão convertidos localmente para MP4 compatível; documentos permanecerão no formato original.'
Write-Host 'Recarregue a extensão e reabra o WhatsApp Web.'
