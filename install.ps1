$ErrorActionPreference = "Stop"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "Installing uv..."
  Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}

uv tool install --upgrade cconnect
uv tool update-shell

Write-Host ""
Write-Host "CConnect installed. Serve it with:  cconnect"
Write-Host "Everything it can do:               cconnect --help"
