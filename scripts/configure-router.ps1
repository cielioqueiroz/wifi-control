$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:LOCALAPPDATA 'WiFiControl'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$credential = Get-Credential -UserName 'admin' -Message 'Acesso administrativo do Huawei AX2'
if ($null -eq $credential) { exit 1 }
$credential | Export-Clixml -LiteralPath (Join-Path $directory 'wifi-control-router.credential.xml')
Write-Host 'Credencial protegida pelo Windows e salva para este usuario. Reinicie o WiFi Control para conectar.'
