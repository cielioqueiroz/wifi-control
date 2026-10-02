param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $root 'manifest.json'))) {
  $root = Join-Path (Split-Path $PSScriptRoot -Parent) 'release\wifi-control-windows'
}
if (-not (Test-Path -LiteralPath (Join-Path $root 'bin\agent.cjs'))) { throw 'Gere o pacote com pnpm package:windows primeiro.' }
$root = (Resolve-Path -LiteralPath $root).Path
$node = (Get-Command node -ErrorAction Stop).Source
$version = & $node --version
if ($version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) { throw 'Instale Node.js 24 ou superior.' }
foreach ($port in @(3001, 4317)) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "A porta $port esta ocupada. Encerre a instancia anterior antes de iniciar." }
}
$data = Join-Path $env:LOCALAPPDATA 'WiFiControl'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$env:WIFI_CONTROL_DB_PATH = Join-Path $data 'wifi-control.sqlite'
$env:WIFI_CONTROL_WEB_ROOT = Join-Path $root 'web'
$env:LOCAL_API_HOST = '127.0.0.1'
$env:LOCAL_API_PORT = '4317'
$env:WIFI_CONTROL_WEB_PORT = '3001'
if (Test-Path -LiteralPath (Join-Path $data 'wifi-control-router.credential.xml')) {
  $env:ROUTER_ADAPTER = 'huawei-ax2'
  $env:ROUTER_BASE_URL = 'http://192.168.3.1'
  $env:ROUTER_GATEWAY_IP = '192.168.3.1'
  $env:ROUTER_CREDENTIAL_REF = 'wifi-control-router'
}
$agentScript = Join-Path $root 'bin\agent.cjs'
$webScript = Join-Path $root 'bin\serve-web.mjs'
$agent = Start-Process -FilePath $node -ArgumentList ('"' + $agentScript + '"') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $data 'agent.log') -RedirectStandardError (Join-Path $data 'agent-error.log')
try {
  $web = Start-Process -FilePath $node -ArgumentList ('"' + $webScript + '"') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $data 'web.log') -RedirectStandardError (Join-Path $data 'web-error.log')
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($agent.HasExited -or $web.HasExited) { throw 'Falha ao iniciar. Consulte os logs em LocalAppData/WiFiControl.' }
    try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/health' -TimeoutSec 1; $page = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001' -TimeoutSec 1; if ($health.ok -and $page.StatusCode -eq 200) { $ready = $true; break } } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ready) { throw 'Tempo esgotado ao iniciar o aplicativo.' }
  @(@{ id = $agent.Id; script = $agentScript }, @{ id = $web.Id; script = $webScript }) | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $data 'processes.json')
  Write-Host 'WiFi Control em http://127.0.0.1:3001'
  if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:3001' }
} catch {
  if ($web -and -not $web.HasExited) { Stop-Process -Id $web.Id }
  if (-not $agent.HasExited) { Stop-Process -Id $agent.Id }
  throw
}
