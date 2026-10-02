$ErrorActionPreference = 'Stop'
$stateFile = Join-Path $env:LOCALAPPDATA 'WiFiControl\processes.json'
if (-not (Test-Path -LiteralPath $stateFile)) { Write-Host 'Nenhuma instancia iniciada por este aplicativo.'; exit 0 }
$records = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
foreach ($record in $records) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$record.id)" -ErrorAction SilentlyContinue
  if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains('"' + [string]$record.script + '"')) {
    Stop-Process -Id ([int]$record.id)
  }
}
Remove-Item -LiteralPath $stateFile
Write-Host 'WiFi Control encerrado.'
